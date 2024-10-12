import { BehaviorSubject, Observable, map, merge, of, share, switchMap } from 'rxjs'
import { Inject, Injectable } from '@nestjs/common'
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

  public constructor() {
    super()

    this.initializeCallbacks.push(() => {
      void this.entityPushService
      void this.prismaClient

      throw new Error()
    })
  }

  public delete(id: number) {
    const receiver = this.receiverMap.get(id)

    if (!receiver) {
      return
    }

    receiver.close()
    this.receiverMap.delete(id)
  }

  public get(id: number) {
    return this.receiverMap.get(id) ?? null
  }

  public put(id: number): Receiver {
    return pipe(
      () => this.receiverMap.get(id),
      io.map(option.fromNullable),
      ioOption.getOrElse(flow(
        () => io.of(new Receiver()),
        io.tap(x => () => this.receiverMap.set(id, x)),
      )),
    )()
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
        ioOption.chainIOK(flow(
          x => x.pipe(
            map(content => ({ content, type: 'message' } as const)),
          ),
          x => () => {
            sourceMap.set(source, x)
            this.sourceSet.add(x)

            return source
          },
        )),
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
