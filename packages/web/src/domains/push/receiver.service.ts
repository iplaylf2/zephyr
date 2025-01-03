import { Inject, Injectable } from '@nestjs/common'
import { Operation, Task, call, createSignal, each, spawn, suspend, useScope } from 'effection'
import { PrismaClient, PrismaTransaction } from '../../repositories/prisma/client.js'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { io, ioOption, option } from 'fp-ts'
import { ConversationService } from '../../repositories/redis/entities/conversation.service.js'
import { PushService as EntityPushService } from '../../repositories/redis/entities/push.service.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { Receiver } from './receiver.js'
import { cOperation } from '../../common/fp-effection/c-operation.js'
import { push } from '../../models/push.js'
import { where } from '../../repositories/prisma/common/where.js'

@Injectable()
export class ReceiverService extends ModuleRaii {
  @Inject()
  private readonly conversationService!: ConversationService

  @Inject()
  private readonly entityPushService!: EntityPushService

  @Inject()
  private readonly prismaClient!: PrismaClient

  private readonly receiverMap = new Map<number, Receiver>()

  private readonly receiverSignal = createSignal<ReceiverEvent>()

  public constructor() {
    super()

    this.initializeCallbacks.push(() => this.listenEvent())
  }

  public put(id: number): Receiver {
    return pipe(
      () => this.receiverMap.get(id),
      io.map(option.fromNullable),
      ioOption.getOrElse(flow(
        () => io.of(new Receiver()),
        io.tap(
          x => () => {
            this.receiverMap.set(id, x)
            this.receiverSignal.send({ receiverId: id, type: 'put' })
          },
        ),
      )),
    )()
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
    if (!tx) {
      return yield * this.prismaClient.$callTransaction(tx => this.subscribe(receiverId, pushes, tx))
    }

    if (0 === pushes.length) {
      return
    }

    const receiver = this.receiverMap.get(receiverId)

    if (!receiver) {
      return
    }

    void this.conversationService

    yield * suspend()
    throw new Error('todo')
  }

  private *unsubscribe(
    receiverId: number,
    pushes: readonly push.Push[],
    tx?: PrismaTransaction,
  ): Operation<void> {
    if (!tx) {
      return yield * this.prismaClient.$callTransaction(tx => this.unsubscribe(receiverId, pushes, tx))
    }

    const receiver = this.receiverMap.get(receiverId)

    if (!receiver) {
      return
    }

    const innerPushes = yield * pipe(
      () => tx.push.findMany({
        select: { id: true, source: true, type: true },
        where: { OR: where.writable(pushes) },
      }),
      cOperation.FromTask.fromTask,
    )()

    const exists = new Set(
      0 === innerPushes.length
        ? []
        : yield * tx
          .$pushSubscription()
          .pushesForQuery(receiverId, innerPushes.map(x => x.id)),
    )

    receiver.unsubscribe(innerPushes.filter(({ id }) => !exists.has(id)))
  }
}

type ReceiverEvent = {
  receiverId: number
  type: 'delete' | 'put'
}
