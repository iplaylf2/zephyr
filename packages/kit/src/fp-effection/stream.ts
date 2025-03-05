import { Directive, Plan, Procedure } from '../effection/operation.js'
import { Subscription, all } from 'effection'
import {
  applicative, apply, chain, fromIO, fromTask, functor,
  io, monad, monadIO, monadTask, monoid, option, pipeable,
  pointed, predicate, refinement, unfoldable, zero,
} from 'fp-ts'
import { constant, flow, pipe } from 'fp-ts/lib/function.js'
import { merge } from '../effection/merge.js'
import { plan } from './plan.js'

export namespace stream{
  export type Stream<T, R> = Procedure<Subscription<T, R>>
  export const URI = 'stream.effection'
  export type URI = typeof URI

  export type Infer<K extends Stream<unknown, unknown>> = K extends Stream<infer T, infer R> ? [T, R] : never

  export const Functor: functor.Functor2<URI> = {
    URI,
    map: (fa, f) => Plan.toProcedure(function* () {
      const subscription = yield* fa

      return {
        * next() {
          const aResult = yield* subscription.next()

          if (true === aResult.done) {
            return aResult
          }

          return { value: f(aResult.value) }
        },
      }
    }),
  }

  export const Pointed: pointed.Pointed2<URI> = {
    URI,
    // eslint-disable-next-line require-yield
    of: a => Plan.toProcedure(function* () {
      const iterator = [a][Symbol.iterator]() as Iterator<any>

      return {
        // eslint-disable-next-line require-yield
        * next() {
          return iterator.next()
        },
      }
    }),
  }

  export const Zero: zero.Zero2<URI> = {
    URI,
    // eslint-disable-next-line require-yield
    zero: () => Plan.toProcedure(function* () {
      return {
        // eslint-disable-next-line require-yield
        * next() { return { done: true, value: void 0 as never } },
      }
    }),
  }

  export const Apply: apply.Apply2<URI> = {
    URI,
    ap: (fab, fa) => Plan.toProcedure(function* () {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const [abSubscription, _aSubscription] = yield* all([fab, Zero.zero() as typeof fa])

      type Ab = Infer<typeof fab>[0]
      type E = Infer<typeof fab>[1]

      let aSubscription = _aSubscription
      let ab: Ab
      let iReturn: IteratorReturnResult<E> | undefined

      return {
        next: function* next(): Directive<IteratorResult<ReturnType<Ab>, E>> {
          if (iReturn) {
            return iReturn
          }

          const { done, value } = yield* aSubscription.next()

          if (true !== done) {
            return { value: ab(value) }
          }

          const [abIR, _aSubscription] = yield* all([abSubscription.next(), fa])

          if (true === abIR.done) {
            iReturn = abIR
          }
          else {
            ab = abIR.value
            aSubscription = _aSubscription
          }

          return yield* next()
        },
      }
    }),
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
    chain: (fa, f) => Plan.toProcedure(function* () {
      type F = ReturnType<typeof f>

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const [aSubscription, _bSubscription] = yield* all([fa, Zero.zero() as F])

      type B = Infer<F>[0]
      type E = Infer<F>[1]

      let bSubscription = _bSubscription
      let iReturn: IteratorReturnResult<E> | undefined

      return {
        next: function* next(): Directive<IteratorResult<B, E>> {
          if (iReturn) {
            return iReturn
          }

          const bIR = yield* bSubscription.next()

          if (true !== bIR.done) {
            return bIR
          }

          const aIR = yield* aSubscription.next()

          if (true === aIR.done) {
            iReturn = aIR
          }
          else {
            bSubscription = yield* f(aIR.value)
          }

          return yield* next()
        },
      }
    }),
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
    fromIO: fa => Plan.toProcedure(function* () {
      const iterator = [fa()][Symbol.iterator]() as Iterator<ReturnType<typeof fa>>

      return {
        // eslint-disable-next-line require-yield
        * next() {
          return iterator.next()
        },
      }
    }),
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
    fromTask: flow(
      plan.FromTask.fromTask,
      fromPlan,
    ) as () => Stream<any, any>,
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
    unfold: <E, A, B>(b: B, f: (b: B) => option.Option<[A, B]>): Stream<A, E> => Plan.toProcedure(function* () {
      let done = false

      return {
        // eslint-disable-next-line require-yield
        * next() {
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
    }),
  }

  export const getMonoid = <E = never, A = never>(): monoid.Monoid<Stream<A, E>> => ({
    concat: (x, y) => Plan.toProcedure(function* () {
      let s = yield* x

      let sBelongY = false

      return {
        next: function* next(): Directive<IteratorResult<A>> {
          const result = yield* s.next()

          if (true !== result.done) {
            return result
          }

          if (sBelongY) {
            return result
          }

          s = yield* y

          sBelongY = true

          return yield* next()
        },
      }
    }),
    empty: Zero.zero<E, A>(),
  })

  export const getMonoidPar = <E = never, A = never>(): monoid.Monoid<Stream<A, E>> => ({
    concat: (x, y) => Plan.toProcedure(function* () {
      const [subscriptionA, streamB] = yield* merge(() => x, () => y)

      function createNextStep(
        subscription: Subscription<A, E>,
      ) {
        return function* () {
          const value = yield* subscription.next()

          return [value, subscription] as const
        }
      }

      let faster = createNextStep(subscriptionA)
      let slower = function* () {
        const subscription = yield* streamB

        return yield* createNextStep(subscription)()
      }

      let singleSubscription: Subscription<A, E> | null = null

      return {
        next: function* (): Directive<IteratorResult<A>> {
          if (singleSubscription) {
            return yield* singleSubscription.next()
          }

          const [a, b] = yield* merge(faster, slower)

          const value = a[0]

          if (true === value.done) {
            faster = null as any
            slower = null as any

            const [value, subscription] = yield* b

            singleSubscription = subscription

            return value
          }
          else {
            faster = createNextStep(a[1])
            slower = Procedure.toPlan(b)

            return value
          }
        },
      }
    }),
    empty: Zero.zero<E, A>(),
  })

  export function repeat<A>(a: A): Stream<A, void> {
    return Unfoldable.unfold(a, a => option.some([a, a] as const))
  }

  export function fromArray<A>(as: readonly A[]): Stream<A, void> {
    return Unfoldable.unfold(
      [as, 0 as number] as const,
      ([as, index]) =>
        index < as.length
          ? option.some([as[index]!, [as, index + 1]] as const)
          : option.none,
    )
  }

  export function fromPlan<A>(fa: plan.Plan<A>): Stream<A, void> {
    return Plan.toProcedure(function* () {
      const a = yield* fa()

      return yield* Pointed.of(a)
    })
  }

  export function takeLeftWhile<E, A, B extends A>(
    predicate: refinement.Refinement<A, B>,
  ): (as: Stream<A, E>) => Stream<B, E>
  export function takeLeftWhile<E, A>(
    predicate: predicate.Predicate<A>
  ): <B extends A>(bs: Stream<B, E>) => Stream<B, E>
  export function takeLeftWhile<E, A>(
    predicate: predicate.Predicate<A>,
  ): (as: Stream<A, E>) => Stream<A, E> {
    return as => Plan.toProcedure(function* () {
      const s = yield* as

      let iReturn: IteratorReturnResult<E> | undefined

      return {
        next: function* next(): Directive<IteratorResult<A, E>> {
          if (iReturn) {
            return iReturn
          }

          const aIR = yield* s.next()

          if (true === aIR.done) {
            iReturn = aIR

            return yield* next()
          }

          if (predicate(aIR.value)) {
            return { value: aIR.value }
          }

          iReturn = { done: true } as IteratorReturnResult<E>

          return yield* next()
        },
      }
    })
  }

  export const map = pipeable.map(Functor)
  export const ap = pipeable.ap(Apply)
  export const chain = pipeable.chain(Chain)
}

declare module 'fp-ts/HKT' {
  export interface URItoKind2<E, A> {
    readonly [stream.URI]: stream.Stream<A, E>
  }
}
