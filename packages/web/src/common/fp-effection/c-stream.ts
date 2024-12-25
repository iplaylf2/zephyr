import { LazyArg, constant, flow, pipe } from 'fp-ts/lib/function.js'
import { Operation, Stream, Subscription, all } from 'effection'
import {
  applicative, apply, chain, fromIO, fromTask, functor,
  io, monad, monadIO, monadTask, monoid, option, pipeable,
  pointed, predicate, refinement, task, unfoldable, zero,
} from 'fp-ts'
import { cOperation } from './c-operation.js'
import { merge } from '../../kits/effection/merge.js'

export namespace cStream{
  export type CStream<T, R> = LazyArg<Stream<T, R>>
  export const URI = 'CStream.effection'
  export type URI = typeof URI

  export const Functor: functor.Functor2<URI> = {
    URI,
    map: (fa, f) =>
      function*() {
        const subscription = yield * fa()

        return {
          *next() {
            const aResult = yield * subscription.next()

            if (true === aResult.done) {
              return aResult
            }

            return { value: f(aResult.value) }
          },
        }
      },
  }

  export const Pointed: pointed.Pointed2<URI> = {
    URI,
    // eslint-disable-next-line require-yield
    of: <E, A>(a: A): CStream<A, E> => function*() {
      const iterator = [a][Symbol.iterator]() as Iterator<A, E>

      return {
        // eslint-disable-next-line require-yield
        *next() {
          return iterator.next()
        },
      }
    },
  }

  export const Zero: zero.Zero2<URI> = {
    URI,
    // eslint-disable-next-line require-yield
    zero: () => function*() {
      return {
        // eslint-disable-next-line require-yield
        *next() { return { done: true, value: void 0 as never } },
      }
    },
  }

  export const Apply: apply.Apply2<URI> = {
    URI,
    ap: <E, A, B>(fab: CStream<(a: A) => B, E>, fa: CStream<A, E>) => function*() {
      const [abSubscription, _aSubscription] = yield * all([fab(), Zero.zero<E, A>()()])

      let aSubscription = _aSubscription
      let ab: (a: A) => B
      let iReturn: IteratorReturnResult<E> | undefined

      return {
        next: function* next(): Operation<IteratorResult<B, E>> {
          if (iReturn) {
            return iReturn
          }

          const { done, value } = yield * aSubscription.next()

          if (true !== done) {
            return { value: ab(value) }
          }

          const [abIR, _aSubscription] = yield * all([abSubscription.next(), fa()])

          if (true === abIR.done) {
            iReturn = abIR
          }
          else {
            ab = abIR.value
            aSubscription = _aSubscription
          }

          return yield * next()
        },
      }
    },
    map: Functor.map,
  }

  export const Applicative: applicative.Applicative2<URI> = {
    URI,
    ap: Apply.ap,
    map: Functor.map,
    of: Pointed.of,
  }

  export const Chain: chain.Chain2<URI> = {
    URI,
    ap: Apply.ap,
    chain: <E, A, B>(fa: CStream<A, E>, f: (a: A) => CStream<B, E>) => function*() {
      const [aSubscription, _bSubscription] = yield * all([fa(), Zero.zero<E, B>()()])

      let bSubscription = _bSubscription
      let iReturn: IteratorReturnResult<E> | undefined

      return {
        next: function *next(): Operation<IteratorResult<B, E>> {
          if (iReturn) {
            return iReturn
          }

          const bIR = yield * bSubscription.next()

          if (true !== bIR.done) {
            return bIR
          }

          const aIR = yield * aSubscription.next()

          if (true === aIR.done) {
            iReturn = aIR
          }
          else {
            bSubscription = yield * f(aIR.value)()
          }

          return yield * next()
        },
      }
    },
    map: Functor.map,
  }

  export const Monad: monad.Monad2<URI> = {
    URI,
    ap: Apply.ap,
    chain: Chain.chain,
    map: Functor.map,
    of: Pointed.of,
  }

  export const FromIO: fromIO.FromIO2<URI> = {
    URI,
    // eslint-disable-next-line require-yield
    fromIO: <A, E>(fa: io.IO<A>): CStream<A, E> => function*() {
      const iterator = [fa()][Symbol.iterator]() as Iterator<A, E>

      return {
        // eslint-disable-next-line require-yield
        *next() {
          return iterator.next()
        },
      }
    },
  }

  export const MonadIO: monadIO.MonadIO2<URI> = {
    URI,
    ap: Monad.ap,
    chain: Monad.chain,
    fromIO: FromIO.fromIO,
    map: Monad.map,
    of: Monad.of,
  }

  export const FromTask: fromTask.FromTask2<URI> = {
    URI,
    fromIO: FromIO.fromIO,
    fromTask: <A, E>(fa: task.Task<A>) => pipe(
      cOperation.FromTask.fromTask(fa),
      cOperation.chain(Pointed.of<E, A>),
    ),
  }

  export const MonadTask: monadTask.MonadTask2<URI> = {
    URI,
    ap: Monad.ap,
    chain: Monad.chain,
    fromIO: FromIO.fromIO,
    fromTask: FromTask.fromTask,
    map: Monad.map,
    of: Monad.of,
  }

  export const Unfoldable: unfoldable.Unfoldable2<URI> = {
    URI,
    // eslint-disable-next-line require-yield
    unfold: <E, A, B>(b: B, f: (b: B) => option.Option<[A, B]>): CStream<A, E> => function* () {
      let done = false

      return {
        // eslint-disable-next-line require-yield
        *next() {
          if (done) {
            return { done } as IteratorResult<A, E>
          }

          return pipe(
            f(b),
            option.fold(
              flow(
                constant({ done: true } as IteratorResult<A, E>),
                io.of,
                io.tap(() => () => (done = true)),
              ),
              flow(
                io.of,
                io.tap(([,_b]) => () => (b = _b)),
                io.map(([a]) => ({ value: a })),
              ),
            ),
          )()
        },
      }
    },
  }

  export const getMonoid = <E = never, A = never>(): monoid.Monoid<CStream<A, E>> => ({
    concat: (x, y) => function*() {
      let s = yield * x()

      let sBelongY = false

      return {
        next: function*next(): Operation<IteratorResult<A>> {
          const result = yield * s.next()

          if (true !== result.done) {
            return result
          }

          if (sBelongY) {
            return result
          }

          s = yield * y()

          sBelongY = true

          return yield * next()
        },
      }
    },
    empty: Zero.zero<E, A>(),
  })

  export const getMonoidPar = <E = never, A = never>(): monoid.Monoid<CStream<A, E>> => ({
    concat: (x, y) => function*() {
      const [subscriptionA, streamB] = yield * merge(x(), y())

      function createNextStep(subscription: Subscription<A, E>) {
        return function*() {
          const value = yield * subscription.next()

          return [createNextStep(subscription), value, subscription] as const
        }
      }

      let faster = createNextStep(subscriptionA)
      let slower = function*() {
        const subscription = yield * streamB

        const nextStep = createNextStep(subscription)

        return yield * nextStep()
      }

      let singleSubscription: Subscription<A, E> | null = null

      return {
        next: function*(): Operation<IteratorResult<A>> {
          if (singleSubscription) {
            return yield * singleSubscription.next()
          }

          const [a, b] = yield * merge(faster(), slower())

          faster = a[0]
          slower = () => b

          const value = a[1]

          if (true === value.done) {
            faster = null as any
            slower = null as any

            const [,value, subscription] = yield * b

            singleSubscription = subscription

            return value
          }

          return value
        },
      }
    },
    empty: Zero.zero<E, A>(),
  })

  export function repeat<A>(a: A): CStream<A, void> {
    return Unfoldable.unfold(a, a => option.some([a, a] as const))
  }

  export function fromArray<A>(as: readonly A[]): CStream<A, void> {
    return Unfoldable.unfold(
      [as, 0 as number] as const,
      ([as, index]) =>
        index < as.length
          ? option.some([as[index]!, [as, index + 1]] as const)
          : option.none,
    )
  }

  export function fromCOperation<A>(a: cOperation.COperation<A>): CStream<A, void> {
    return cOperation.Monad.chain(a, Pointed.of<void, A>)
  }

  export function takeLeftWhile<E, A, B extends A>(
    predicate: refinement.Refinement<A, B>,
  ): (as: CStream<A, E>) => CStream<B, E>
  export function takeLeftWhile<E, A>(
    predicate: predicate.Predicate<A>
  ): <B extends A>(bs: CStream<B, E>) => CStream<B, E>
  export function takeLeftWhile<E, A>(
    predicate: predicate.Predicate<A>,
  ): (as: CStream<A, E>) => CStream<A, E> {
    return as => function*() {
      const s = yield * as()
      let iReturn: IteratorReturnResult<E> | undefined

      return {
        next: function*next(): Operation<IteratorResult<A, E>> {
          if (iReturn) {
            return iReturn
          }

          const aIR = yield * s.next()

          if (true === aIR.done) {
            iReturn = aIR

            return yield * next()
          }

          if (predicate(aIR.value)) {
            return { value: aIR.value }
          }

          iReturn = { done: true } as IteratorReturnResult<E>

          return yield * next()
        },
      }
    }
  }

  export const map = pipeable.map(Functor)
  export const ap = pipeable.ap(Apply)
  export const chain = pipeable.chain(Chain)
}

declare module 'fp-ts/HKT' {
  export interface URItoKind2<E, A> {
    readonly [cStream.URI]: cStream.CStream<A, E>
  }
}
