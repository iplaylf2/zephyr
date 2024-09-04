import { Stream, all, call } from 'effection'
import { applicative, apply, chain, fromIO, fromTask, functor, io, ioOption, monad, monadIO, monadTask, monoid, pointed, unfoldable, zero } from 'fp-ts'
import { pipe } from 'fp-ts/lib/function.js'

export namespace ioStream{
  export type IOStream<T, R> = io.IO<Stream<T, R>>
  export const URI = 'IOStream.effection'
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
    URI: 'IOStream.effection',
    // eslint-disable-next-line require-yield
    of: a => function*() {
      const iterator = [a][Symbol.iterator]()
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
    ap: (fab, fa) => function*() {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const [abSubscription, _aSubscription] = yield * all([fab(), (Zero.zero() as typeof fa)()])

      let aSubscription = _aSubscription
      let ab: typeof fab extends IOStream<infer T, any> ? T : never
      let iR: IteratorReturnResult<any> | undefined

      return {
        next: function* next() {
          if (iR) {
            return iR
          }

          const { done, value } = yield * aSubscription.next()

          if (true !== done) {
            return { value: ab(value) }
          }

          const [abIR, _aSubscription] = yield * all([abSubscription.next(), fa()])

          if (true === abIR.done) {
            iR = abIR

            return abIR
          }

          ab = abIR.value
          aSubscription = _aSubscription

          return next()
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
    chain: (fa, f) => function*() {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const [aSubscription, _bSubscription] = yield * all([fa(), (Zero.zero() as ReturnType<(typeof f)>)()])

      let bSubscription = _bSubscription
      let iR: IteratorReturnResult<any> | undefined

      return {
        next: function *next() {
          if (iR) {
            return iR
          }

          const bIR = yield * bSubscription.next()

          if (true !== bIR.done) {
            return bIR
          }

          const aIR = yield * aSubscription.next()

          if (true === aIR.done) {
            iR = aIR

            return aIR
          }

          bSubscription = yield * f(aIR.value)()

          return next()
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
    fromIO: fa => Pointed.of(fa()),
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
    fromTask: fa => function*() {
      const iterator = [yield * call(fa())][Symbol.iterator]()
      return {
        // eslint-disable-next-line require-yield
        *next() {
          return iterator.next()
        },
      }
    },
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
    unfold: (b, f) => function* () {
      let done = false
      return {
        // eslint-disable-next-line require-yield
        *next() {
          if (done) {
            return { done, value: void 0 }
          }

          return pipe(
            f(b),
            ioOption.fromOption,
            ioOption.tapIO(([,_b]) => () => {
              b = _b
              done = true
            }),
            ioOption.match(
              () => ({ done: true, value: void 0 as any }),
              ([a]) => ({ done: false, value: a }),
            ),
          )()
        },
      }
    },
  }

  export const getMonoid = <E = never, A = never>(): monoid.Monoid<IOStream<A, E>> => ({
    concat: (x, y) => function*() {
      let s = yield * x()
      let sBelongY = false
      return {
        next: function*next() {
          const result = yield * s.next()

          if (true !== result.done) {
            return result
          }

          if (sBelongY) {
            return result
          }

          s = yield * y()

          sBelongY = true

          return next()
        },
      }
    },
    empty: Zero.zero<E, A>(),
  })

}

declare module 'fp-ts/HKT' {
  export interface URItoKind2<E, A> {
    readonly [ioStream.URI]: ioStream.IOStream<A, E>
  }
}
