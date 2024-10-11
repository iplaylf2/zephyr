import { Inject, Injectable } from '@nestjs/common'
import { Observable, Subject, Subscription } from 'rxjs'
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

  public constructor() {
    super()

    this.initializeCallbacks.push(() => {
      void this.entityPushService
      void this.prismaClient

      throw new Error()
    })
  }

  public ensure(id: number): Receiver {

  }
}

class Receiver {
  private _isClosed = false
  private readonly subject = new Subject<push.Message>()
  private readonly subscriptionMap = new Map<string, Map<number, Subscription>>()

  public get isClosed() {
    return this._isClosed
  }

  public asObservable() {
    return this.subject.asObservable()
  }

  public close() {
    if (this.isClosed) {
      return
    }

    for (const [, xx] of this.subscriptionMap) {
      for (const [, x] of xx) {
        x.unsubscribe()
      }
    }

    this.subscriptionMap.clear()
    this.subject.next({ type: 'delete' })
    this.subject.complete()
    this._isClosed = true
  }

  public subscribe(
    type: string,
    sources: Array<{ observable: Observable<JsonValue>, source: number }>,
  ) {
    if (this.isClosed) {
      return
    }

    const subscriptionMap = pipe(
      () => this.subscriptionMap.get(type),
      io.map(option.fromNullable),
      ioOption.getOrElse(flow(
        () => io.of(new Map()),
        io.tap(x => () => this.subscriptionMap.set(type, x)),
      )),
    )()

    const subscribedSources = pipe(
      sources,
      readonlyArray.map(({ observable, source }) =>
        () => {
          if (subscriptionMap.get(source)) {
            return option.none
          }

          subscriptionMap.set(source, observable.subscribe((x) => {
            this.subject.next({ content: x, type: 'message' })
          }))

          return option.some(source)
        },
      ),
      io.sequenceArray,
      io.map(
        readonlyArray.filterMap(identity.of),
      ),
    )()

    if (0 === subscribedSources.length) {
      return
    }

    this.subject.next({ push: { sources: subscribedSources, type }, type: 'subscribe' })
  }

  public unsubscribe(type: string, sources: readonly number[]) {
    if (this.isClosed) {
      return
    }

    const subscriptionMap = this.subscriptionMap.get(type)

    if (!subscriptionMap) {
      return
    }

    const unsubscribedSources = pipe(
      sources,
      readonlyArray.map(source =>
        () => {
          const subscription = subscriptionMap.get(source)

          if (!subscription) {
            return option.none
          }

          subscription.unsubscribe()
          subscriptionMap.delete(source)

          return option.some(source)
        },
      ),
      io.sequenceArray,
      io.map(
        readonlyArray.filterMap(identity.of),
      ),
    )()

    if (0 === unsubscribedSources.length) {
      return
    }

    this.subject.next({ push: { sources: unsubscribedSources, type }, type: 'unsubscribe' })
  }
}
