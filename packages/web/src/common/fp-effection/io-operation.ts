import { Operation, all, call } from 'effection'
import { applicative, apply, chain, fromIO, fromTask, functor, io, monad, monadIO, monadTask, pointed } from 'fp-ts'

export namespace ioOperation{
  export type IOOperation<A> = io.IO<Operation<A>>

  export const URI = 'IOOperation'

  export type URI = typeof URI

  export const Functor: functor.Functor1<URI> = {
    URI,
    map<A, B>(fa: IOOperation<A>, f: (a: A) => B): IOOperation<B> {
      return function*() {
        return f(yield * fa())
      }
    },
  }

  export const Pointed: pointed.Pointed1<URI> = {
    URI,
    of: function <A>(a: A): IOOperation<A> {
      // eslint-disable-next-line require-yield
      return function*() {
        return a
      }
    },
  }

  export const ApplyPar: apply.Apply1<URI> = {
    URI,
    ap: function <A, B>(fab: IOOperation<(a: A) => B>, fa: IOOperation<A>): IOOperation<B> {
      return function*() {
        const [ab, a] = yield * all([fab(), fa()])
        return ab(a)
      }
    },
    map: Functor.map,
  }

  export const ApplySeq: apply.Apply1<URI> = {
    URI,
    ap: function <A, B>(fab: IOOperation<(a: A) => B>, fa: IOOperation<A>): IOOperation<B> {
      return function*() {
        return (yield * fab())(yield * fa())
      }
    },
    map: Functor.map,
  }

  export const ApplicativePar: applicative.Applicative1<URI> = {
    URI,
    ap: ApplyPar.ap,
    map: Functor.map,
    of: Pointed.of,
  }

  export const ApplicativeSeq: applicative.Applicative1<URI> = {
    URI,
    ap: ApplySeq.ap,
    map: Functor.map,
    of: Pointed.of,
  }

  export const Chain: chain.Chain1<URI> = {
    URI,
    ap: ApplicativeSeq.ap,
    chain: function <A, B>(fa: IOOperation<A>, f: (a: A) => IOOperation<B>): IOOperation<B> {
      return function*() {
        return yield * (f(yield * fa()))()
      }
    },
    map: Functor.map,
  }

  export const Monad: monad.Monad1<URI> = {
    URI,
    ap: ApplicativeSeq.ap,
    chain: Chain.chain,
    map: Functor.map,
    of: Pointed.of,
  }

  export const FromIO: fromIO.FromIO1<URI> = {
    URI,
    fromIO: fa => Pointed.of(fa()),
  }

  export const MonadIO: monadIO.MonadIO1<URI> = {
    URI,
    ap: Monad.ap,
    chain: Monad.chain,
    fromIO: FromIO.fromIO,
    map: Monad.map,
    of: Monad.of,
  }

  export const FromTask: fromTask.FromTask1<URI> = {
    URI,
    fromIO: FromIO.fromIO,
    fromTask: fa => io.of(call(fa)),
  }

  export const MonadTask: monadTask.MonadTask1<URI> = {
    URI,
    ap: Monad.ap,
    chain: Monad.chain,
    fromIO: FromIO.fromIO,
    fromTask: FromTask.fromTask,
    map: Monad.map,
    of: Monad.of,
  }
}

declare module 'fp-ts/HKT' {
  export interface URItoKind<A> {
    readonly [ioOperation.URI]: ioOperation.IOOperation<A>
  }
}
