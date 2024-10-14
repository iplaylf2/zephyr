import { BehaviorSubject, Observable, map, merge, of, share, switchMap } from 'rxjs'
import { Inject, Injectable } from '@nestjs/common'
import { Operation, Task, createSignal, each, spawn, useScope } from 'effection'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { identity, io, ioOption, option, readonlyArray } from 'fp-ts'
import { PushService as EntityPushService } from '../../repositories/redis/entities/push.service.js'
import { JsonValue } from 'type-fest'
import { ModuleRaii } from '../../common/module-raii.js'
import { PrismaClient } from '../../repositories/prisma/client.js'
import { push } from '../../models/push.js'

@Injectable()
export class ReceiverService extends ModuleRaii {
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

  public delete(id: number) {
    const receiver = this.receiverMap.get(id)

    if (!receiver) {
      return
    }

    receiver.close()
    this.receiverMap.delete(id)
    this.receiverSignal.send({ receiver: id, type: 'delete' })
  }

  public get(id: number) {
    return this.receiverMap.get(id) ?? null
  }

  public put(id: number): Receiver {
    const receiver = pipe(
      () => this.receiverMap.get(id),
      io.map(option.fromNullable),
      ioOption.getOrElse(flow(
        () => io.of(new Receiver()),
        io.tap(x => () => {
          this.receiverMap.set(id, x)
          this.receiverSignal.send({ receiver: id, type: 'put' })
        }),
      )),
    )()

    return receiver
  }

  private *listenEvent() {
    const taskMap = new Map<number, Task<unknown>>()

    for (const { receiver, type } of yield * each(this.receiverSignal)) {
      switch (type) {
        case 'delete':{
          const task = taskMap.get(receiver)

          if (!task) {
            return
          }

          yield * task.halt()

          taskMap.delete(receiver)
        }
          break
        case 'put':{
          taskMap.set(receiver, yield * spawn(() => this.listenNotification(receiver)))
        }
          break
      }

      yield * each.next()
    }
  }

  private *listenNotification(receiver: number): Operation<void> {
    const notification = this.entityPushService.getNotification()

    const client = yield * notification.isolate()

    const channel = notification.getChannel(receiver)

    try {
      const scope = yield * useScope()

      yield * client.subscribe(channel, (message) => {
        switch (message.type) {
          case 'delete':
            void scope.run(() => this.onReceiverDelete(receiver))
            break
          case 'subscribe':
            void scope.run(() => this.onReceiverSubscribe(receiver, message.push))
            break
          case 'unsubscribe':
            void scope.run(() => this.onReceiverUnsubscribe(receiver, message.push))
            break
        }
      })
    }
    finally {
      yield * client.unsubscribe(channel)
    }
  }

  private *onReceiverDelete(receiver: number) {

  }

  private *onReceiverSubscribe(receiver: number, push: { sources: readonly number[], type: string }) {

  }

  private *onReceiverUnsubscribe(receiver: number, push: { sources: readonly number[], type: string }) {

  }
}

class Receiver {
  public readonly shared

  private _isClosed = false
  private readonly combinedSubject = new BehaviorSubject<readonly Observable<push.Message>[]>([])
  private readonly sourceMap = new Map<string, Map<number, Observable<push.Message>>>()
  private readonly sourceSet = new Set<Observable<push.Message>>()

  public constructor() {
    this.shared = this.combinedSubject.pipe(
      switchMap(x => merge(...x)),
      share(),
    )
  }

  public get isClosed() {
    return this._isClosed
  }

  public close() {
    if (this.isClosed) {
      return
    }

    this.sourceSet.clear()
    this.sourceMap.clear()
    this.combinedSubject.next([of({ type: 'delete' })])
    this.combinedSubject.complete()
    this._isClosed = true
  }

  public subscribe(
    type: string,
    sources: Array<{ observable: Observable<JsonValue>, source: number }>,
  ) {
    if (this.isClosed) {
      return
    }

    const sourceMap = pipe(
      () => this.sourceMap.get(type),
      io.map(option.fromNullable),
      ioOption.getOrElse(flow(
        () => io.of(new Map()),
        io.tap(x => () => this.sourceMap.set(type, x)),
      )),
    )()

    const subscribedSources = pipe(
      sources,
      readonlyArray.map(({ observable, source }) => pipe(
        () => sourceMap.get(source) ? option.none : option.some(observable),
        ioOption.map(x => x.pipe(
          map(content => ({ content, type: 'message' } as const)),
        )),
        ioOption.chainIOK(x => () => {
          sourceMap.set(source, x)
          this.sourceSet.add(x)

          return source
        }),
      )),
      io.sequenceArray,
      io.map(
        readonlyArray.filterMap(identity.of),
      ),
    )()

    if (0 === subscribedSources.length) {
      return
    }

    this.combinedSubject.next([
      of({ push: { sources: subscribedSources, type }, type: 'subscribe' }),
      ...this.sourceSet,
    ])
  }

  public unsubscribe(type: string, sources: readonly number[]) {
    if (this.isClosed) {
      return
    }

    const sourceMap = this.sourceMap.get(type)

    if (!sourceMap) {
      return
    }

    const unsubscribedSources = pipe(
      sources,
      readonlyArray.map(source => pipe(
        () => sourceMap.get(source),
        io.map(option.fromNullable),
        ioOption.chainIOK(x =>
          () => {
            sourceMap.delete(source)
            this.sourceSet.delete(x)

            return source
          },
        ),
      )),
      io.sequenceArray,
      io.map(
        readonlyArray.filterMap(identity.of),
      ),
    )()

    if (0 === unsubscribedSources.length) {
      return
    }

    this.combinedSubject.next([
      of({ push: { sources: unsubscribedSources, type }, type: 'unsubscribe' }),
      ...this.sourceSet,
    ])
  }
}

type ReceiverEvent = {
  receiver: number
  type: 'delete' | 'put'
}
