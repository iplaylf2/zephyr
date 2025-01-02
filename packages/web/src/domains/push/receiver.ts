import { BehaviorSubject, Observable, Subject, finalize, map, merge, of, share, switchMap } from 'rxjs'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { identity, io, ioOption, option, readonlyArray } from 'fp-ts'
import { JKMap } from '../../kits/jk-map.js'
import { JsonValue } from 'type-fest'
import { push } from '../../models/push.js'

export class Receiver {
  public readonly shared

  private _isClosed = false
  private readonly combinedSubject = new BehaviorSubject<readonly Observable<push.Message>[]>([])
  private readonly innerSubject = new Subject<push.Message>()
  private readonly sourceMap = new JKMap<[string, number], Observable<push.Message>>()

  public constructor() {
    this.shared = this.combinedSubject.pipe(
      switchMap(x => merge(...x)),
      share({
        resetOnRefCountZero: true,
      }),
    )
  }

  public get isClosed() {
    return this._isClosed
  }

  public close() {
    if (this.isClosed) {
      return
    }

    this.sourceMap.clear()
    this.combinedSubject.next([of({ type: 'delete' })])
    this.combinedSubject.complete()
    this.innerSubject.complete()
    this._isClosed = true
  }

  public subscribe(
    pushes: ReadonlyArray<{
      observable: Observable<JsonValue>
      push: push.Push
    }>,
  ) {
    if (this.isClosed) {
      return
    }

    const subscribedPushes = pipe(
      pushes,
      readonlyArray.map(flow(
        push => () => this.sourceMap.has([push.push.type, push.push.source]) ? option.none : option.some(push),
        ioOption.chainIOK(
          ({ observable, push }) => () => {
            this.sourceMap.set(
              [push.type, push.source],
              observable.pipe(
                map(content => ({ content, push, type: 'message' } as const)),
                finalize(() => {
                  this.innerSubject.next({ pushes: [push], type: 'complete' })
                }),
              ),
            )

            return push
          },
        ),
      )),
      io.sequenceArray,
      io.map(
        readonlyArray.filterMap(identity.of),
      ),
    )()

    if (0 === subscribedPushes.length) {
      return
    }

    this.combinedSubject.next([
      this.innerSubject,
      of({ pushes: subscribedPushes, type: 'subscribe' }),
      ...this.sourceMap.values(),
    ])
  }

  public unsubscribe(pushes: readonly push.Push[]) {
    if (this.isClosed) {
      return
    }

    const unsubscribedPushes = pipe(
      pushes,
      readonlyArray.map(flow(
        push => () => this.sourceMap.has([push.type, push.source]) ? option.some(push) : option.none,
        ioOption.tapIO(({ source, type }) => () => this.sourceMap.delete([type, source])),
      )),
      io.sequenceArray,
      io.map(
        readonlyArray.filterMap(identity.of),
      ),
    )()

    if (0 === unsubscribedPushes.length) {
      return
    }

    this.combinedSubject.next([
      this.innerSubject,
      of({ pushes: unsubscribedPushes, type: 'unsubscribe' }),
      ...this.sourceMap.values(),
    ])
  }
}
