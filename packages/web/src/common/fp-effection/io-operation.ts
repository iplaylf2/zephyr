import { Operation, all, call } from 'effection'
import { applicative, apply, chain, fromIO, fromTask, functor, io, monad, monadIO, monadTask, pointed } from 'fp-ts'

export namespace ioOperation{
  export type IOOperation<A> = io.IO<Operation<A>>
  export const URI = 'IOOperation.effection'
  export type URI = typeof URI

  export const Functor: functor.Functor1<URI> = {
    URI,
    map: (fa, f) => function*() {
      return f(yield * fa())
    },
  }

  export const Pointed: pointed.Pointed1<URI> = {
    URI,
    // eslint-disable-next-line require-yield
    of: a => function*() {
      return a
    },
  }

  export const ApplyPar: apply.Apply1<URI> = {
    URI,
    ap: (fab, fa) => function*() {
      const [ab, a] = yield * all([fab(), fa()])

      return ab(a)
    },
    map: Functor.map,
  }

  export const ApplySeq: apply.Apply1<URI> = {
    URI,
    ap: (fab, fa) => function*() {
      return (yield * fab())(yield * fa())
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
    ap: ApplyPar.ap,
    chain: (fa, f) => function*() {
      return yield * (f(yield * fa()))()
    },
    map: Functor.map,
  }

  export const Monad: monad.Monad1<URI> = {
    URI,
    ap: ApplyPar.ap,
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

  export const map: <A, B>(f: (a: A) => B) => (fa: IOOperation<A>) => IOOperation<B> = f => fa => Functor.map(fa, f)
  export const apPar: <A>(fa: IOOperation<A>) => <B>(fab: IOOperation<(a: A) => B>) => IOOperation<B> = fa => fab => ApplyPar.ap(fab, fa)
  export const apSeq: <A>(fa: IOOperation<A>) => <B>(fab: IOOperation<(a: A) => B>) => IOOperation<B> = fa => fab => ApplySeq.ap(fab, fa)
  export const chain: <A, B>(f: (a: A) => IOOperation<B>) => (ma: IOOperation<A>) => IOOperation<B> = f => ma => Monad.chain(ma, f)
}

declare module 'fp-ts/HKT' {
  export interface URItoKind<A> {
    readonly [ioOperation.URI]: ioOperation.IOOperation<A>
  }
}
