import { Inject, Injectable } from '@nestjs/common'
import { Observable, defer, finalize, share } from 'rxjs'
import { Operation, Scope, Task, call, createSignal, each, lift, spawn, suspend, useScope } from 'effection'
import { PrismaClient, PrismaTransaction } from '../../repositories/prisma/client.js'
import { either, ioEither, readonlyArray } from 'fp-ts'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { ConversationService } from '../../repositories/redis/entities/conversation.service.js'
import { PushService as EntityPushService } from '../../repositories/redis/entities/push.service.js'
import { JKMap } from '../../kits/jk-map.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { Receiver } from './receiver.js'
import { cOperation } from '../../common/fp-effection/c-operation.js'
import { conversation } from '../../models/conversation.js'
import { group } from '../../repositories/redis/commands/stream/group.js'
import { push } from '../../models/push.js'
import { randomUUID } from 'crypto'
import { where } from '../../repositories/prisma/common/where.js'

@Injectable()
export class ReceiverService extends ModuleRaii {
  @Inject()
  private readonly conversationService!: ConversationService

  @Inject()
  private readonly entityPushService!: EntityPushService

  @Inject()
  private readonly prismaClient!: PrismaClient

  private readonly pushObservableMap = new JKMap<[string, number], Observable<conversation.Message>>()

  private readonly receiverMap = new Map<number, Receiver>()

  private readonly receiverSignal = createSignal<ReceiverEvent>()

  private scope!: Scope

  public constructor() {
    super()

    this.initializeCallbacks.push(function*(this: ReceiverService) {
      this.scope = yield * useScope()
    }.bind(this))
    this.initializeCallbacks.push(() => this.listenEvent())
  }

  public put(id: number): Receiver {
    return pipe(
      () => either.fromNullable(id)(this.receiverMap.get(id)),
      ioEither.mapLeft(() => new Receiver()),
      ioEither.orElseFirstIOK(
        receiver => () => {
          this.receiverMap.set(id, receiver)
          this.receiverSignal.send({ receiverId: id, type: 'put' })
        },
      ),
      ioEither.toUnion,
    )()
  }

  private buildPushObservable(push: push.Push) {
    return defer(
      pipe(
        () => either.fromNullable(push)(this.pushObservableMap.get([push.type, push.source])),
        ioEither.mapLeft(
          push => new Observable<conversation.Message>((subscriber) => {
            const task = this.scope.run(function*(this: ReceiverService) {
              const records = this.conversationService.getRecords(push.type, push.source)
              const serialGroup = new group.Serial(records, randomUUID())

              try {
                yield * records.groupCreate(serialGroup.group, '$', { MKSTREAM: true })
                yield * serialGroup.read(
                  randomUUID(),
                  lift(({ id, message }) => { subscriber.next({ id, ...message }) }),
                )
              }
              catch (e) {
                subscriber.error(e)
              }
              finally {
                yield * records.groupDestroy(serialGroup.group)
              }
            }.bind(this))

            return () => {
              void task.halt()
            }
          }),
        ),
        ioEither.mapLeft(
          observable => observable.pipe(
            finalize(() => this.pushObservableMap.delete([push.type, push.source])),
            share(),
          ),
        ),
        ioEither.orElseFirstIOK(
          observable => () => this.pushObservableMap.set([push.type, push.source], observable),
        ),
        ioEither.toUnion,
      ),
    )
  }

  private delete(id: number) {
    const receiver = this.receiverMap.get(id)

    if (!receiver) {
      return
    }

    receiver.close()
    this.receiverMap.delete(id)
    this.receiverSignal.send({ receiverId: id, type: 'delete' })
  }

  private *listenEvent() {
    const taskMap = new Map<number, Task<unknown>>()

    for (const { receiverId, type } of yield * each(this.receiverSignal)) {
      switch (type) {
        case 'delete':{
          const task = taskMap.get(receiverId)

          if (!task) {
            return
          }

          try {
            yield * task.halt()
          }
          finally {
            taskMap.delete(receiverId)
          }
        }
          break
        case 'put':{
          const task = taskMap.get(receiverId)

          if (task) {
            return
          }

          taskMap.set(receiverId, yield * spawn(() => this.raiiReceiver(receiverId)))
        }
          break
      }

      yield * each.next()
    }
  }

  private *onReceiverDelete(receiverId: number) {
    const exists = yield * this.prismaClient.$pushReceiver().forQuery([receiverId])

    if (0 < exists.length) {
      return
    }

    this.delete(receiverId)
  }

  private onReceiverSubscribe(receiverId: number, pushes: readonly push.Push[]) {
    return this.subscribe(receiverId, pushes)
  }

  private onReceiverUnsubscribe(receiverId: number, pushes: readonly push.Push[]) {
    return this.unsubscribe(receiverId, pushes)
  }

  private raiiReceiver(receiverId: number): Operation<void> {
    return call(
      function*(this: ReceiverService) {
        const notification = this.entityPushService.getNotification()

        const client = yield * notification.isolate()

        const channel = notification.getChannel(receiverId)

        const scope = yield * useScope()

        yield * client.subscribe(channel, (message) => {
          switch (message.type) {
            case 'delete':
              void scope.run(() => this.onReceiverDelete(receiverId))
              break
            case 'subscribe':
              void scope.run(() => this.onReceiverSubscribe(receiverId, message.pushes))
              break
            case 'unsubscribe':
              void scope.run(() => this.onReceiverUnsubscribe(receiverId, message.pushes))
              break
          }
        })

        yield * this.prismaClient.$callTransaction(
          function* (this: ReceiverService, tx: PrismaTransaction) {
            const pushIdArray = yield * tx.$pushSubscription().pushesForQueryByReceiver(receiverId)

            const pushes = yield * pipe(
              () => tx.push.findMany({
                select: { source: true, type: true },
                where: { expiredAt: { gt: new Date() }, id: { in: where.writable(pushIdArray) } },
              }),
              cOperation.FromTask.fromTask,
            )()

            yield * this.subscribe(receiverId, pushes, tx)
          }.bind(this))

        yield * suspend()
      }.bind(this),
    )
  }

  private *subscribe(
    receiverId: number,
    pushes: readonly push.Push[],
    tx?: PrismaTransaction,
  ): Operation<void> {
    const receiver = this.receiverMap.get(receiverId)

    if (!receiver || 0 === pushes.length) {
      return
    }

    if (!tx) {
      return yield * this.prismaClient.$callTransaction(tx => this.subscribe(receiverId, pushes, tx))
    }

    const innerPushes = yield * pipe(
      () => tx.push.findMany({
        select: { id: true, source: true, type: true },
        where: { OR: where.writable(pushes) },
      }),
      cOperation.FromTask.fromTask,
    )()

    if (0 === innerPushes.length) {
      return
    }

    const existsSubscriptions = yield * pipe(
      innerPushes,
      readonlyArray.map(x => x.id),
      pushes => () => tx
        .$pushSubscription()
        .pushesForQuery(receiverId, pushes),
      cOperation.map(flow(
        x => new Set(x),
        set => innerPushes.filter(x => set.has(x.id)),
      )),
    )()

    receiver.subscribe(
      existsSubscriptions.map(
        push => ({
          observable: this.buildPushObservable(push),
          push,
        }),
      ),
    )
  }

  private *unsubscribe(
    receiverId: number,
    pushes: readonly push.Push[],
    tx?: PrismaTransaction,
  ): Operation<void> {
    const receiver = this.receiverMap.get(receiverId)

    if (!receiver || 0 === pushes.length) {
      return
    }

    if (!tx) {
      return yield * this.prismaClient.$callTransaction(tx => this.unsubscribe(receiverId, pushes, tx))
    }

    const innerPushes = yield * pipe(
      () => tx.push.findMany({
        select: { id: true, source: true, type: true },
        where: { OR: where.writable(pushes) },
      }),
      cOperation.FromTask.fromTask,
    )()

    const existsSubscriptions = new Set(
      0 === innerPushes.length
        ? []
        : yield * tx
          .$pushSubscription()
          .pushesForQuery(receiverId, innerPushes.map(x => x.id)),
    )

    receiver.unsubscribe(innerPushes.filter(({ id }) => !existsSubscriptions.has(id)))
  }
}

type ReceiverEvent = {
  receiverId: number
  type: 'delete' | 'put'
}
