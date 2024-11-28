import { LazyArg, flow } from 'fp-ts/lib/function.js'
import { Operation, all, call } from 'effection'
import {
  applicative, apply, chain, chainRec, either, fromIO, fromTask, functor,
  io, monad, monadIO, monadTask, pipeable, pointed,
} from 'fp-ts'

export namespace cOperation{
  export type COperation<A> = LazyArg <Operation<A>>
  export const URI = 'COperation.effection'
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
    fromTask: flow(call, io.of) as any,
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

  export const ChainRec: chainRec.ChainRec1<URI> = {
    URI,
    ap: Chain.ap,
    chain: Chain.chain,
    chainRec: (a, f) => function*() {
      let x = a

      while (true) {
        const result = yield * f(x)()

        if (either.isLeft(result)) {
          x = result.left

          continue
        }

        return result.right
      }
    },
    map: Chain.map,
  }

  export function sequenceArray<A>(arr: ReadonlyArray<COperation<A>>): COperation<ReadonlyArray<A>> {
    return () => all(arr.map(x => x()))
  }

  export const map = pipeable.map(Functor)
  export const apPar = pipeable.ap(ApplyPar)
  export const apSeq = pipeable.ap(ApplySeq)
  export const chain = pipeable.chain(Chain)
}

declare module 'fp-ts/HKT' {
  export interface URItoKind<A> {
    readonly [cOperation.URI]: cOperation.COperation<A>
  }
}
