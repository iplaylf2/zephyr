import { Yielded, Operation as _Operation, all, call } from 'effection'
import {
  applicative, apply, chain, chainRec, either, fromIO, fromTask, functor,
  monad, monadIO, monadTask, pipeable, pointed,
} from 'fp-ts'

export namespace operation{
  export type Operation<T> = _Operation<T>
  export const URI = 'operation.effection'
  export type URI = typeof URI
  export type Infer<T extends Operation<unknown>> = Yielded<T>

  export const Functor: functor.Functor1<URI> = {
    URI,
    map: function*(fa, f) {
      return f(yield * fa)
    },
  }

  export const Pointed: pointed.Pointed1<URI> = {
    URI,
    // eslint-disable-next-line require-yield
    of: function*(a) {
      return a
    },
  }

  export const ApplyPar: apply.Apply1<URI> = {
    URI,
    ap: function*(fab, fa) {
      const [ab, a] = yield * all([fab, fa])

      return ab(a)
    },
    map: Functor.map,
  }

  export const ApplySeq: apply.Apply1<URI> = {
    URI,
    ap: function*(fab, fa) {
      return (yield * fab)(yield * fa)
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
    chain: function*(fa, f) {
      return yield * f(yield * fa)
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
    // eslint-disable-next-line require-yield
    fromIO: function*(fa) {
      return fa()
    },
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
    fromTask: call,
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
    chainRec: function*(a, f) {
      let x = a

      while (true) {
        const result = yield * f(x)

        if (either.isLeft(result)) {
          x = result.left

          continue
        }

        return result.right
      }
    },
    map: Chain.map,
  }

  export function sequenceArray<A>(arr: ReadonlyArray<Operation<A>>): Operation<ReadonlyArray<A>> {
    return all(arr)
  }

  export const map = pipeable.map(Functor)
  export const apPar = pipeable.ap(ApplyPar)
  export const apSeq = pipeable.ap(ApplySeq)
  export const chain = pipeable.chain(Chain)
}

declare module 'fp-ts/HKT' {
  export interface URItoKind<A> {
    readonly [operation.URI]: operation.Operation<A>
  }
}
