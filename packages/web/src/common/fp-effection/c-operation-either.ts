import {
  applicative, apply, chain, either, eitherT, fromIO, fromTask,
  functor, monad, monadIO, monadTask, pointed, task,
  taskEither,
} from 'fp-ts'
import { cOperation } from './c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'

export namespace cOperationEither{
  export type COperationEither<E, A> = cOperation.COperation<either.Either<E, A>>
  export const URI = 'COperationEither.effection'
  export type URI = typeof URI

  export const Functor: functor.Functor2<URI> = {
    URI,
    map: (fa, f) => map(f)(fa),
  }

  export const Pointed: pointed.Pointed2<URI> = {
    URI,
    of: eitherT.right(cOperation.Pointed),
  }

  export const ApplyPar: apply.Apply2<URI> = {
    URI,
    ap: (fab, fa) => apPar(fa)(fab),
    map: Functor.map,
  }

  export const ApplySeq: apply.Apply2<URI> = {
    URI,
    ap: (fab, fa) => apSeq(fa)(fab),
    map: Functor.map,
  }

  export const ApplicativePar: applicative.Applicative2<URI> = {
    URI,
    ap: ApplyPar.ap,
    map: Functor.map,
    of: Pointed.of,
  }

  export const ApplicativeSeq: applicative.Applicative2<URI> = {
    URI,
    ap: ApplySeq.ap,
    map: Functor.map,
    of: Pointed.of,
  }

  export const Chain: chain.Chain2<URI> = {
    URI,
    ap: ApplyPar.ap,
    chain: (fa, f) => chain(f)(fa),
    map: Functor.map,
  }

  export const Monad: monad.Monad2<URI> = {
    URI,
    ap: ApplyPar.ap,
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

  export function fromCOperation<A>(a: cOperation.COperation<A>): COperationEither<void, A> {
    return cOperation.chain(Pointed.of)(a)
  }

  export function fromTaskEither<E, A>(a: taskEither.TaskEither<E, A>): COperationEither<E, A> {
    return cOperation.FromTask.fromTask(a)
  }

  export function tryCatch<E, A>(
    f: cOperation.COperation<A>,
    onRejected: (reason: unknown) => E,
  ): COperationEither<E, A> {
    return function*() {
      try {
        return either.right(yield * f())
      }
      catch (e) {
        return either.left(onRejected(e))
      }
    }
  }

  export const map = eitherT.map(cOperation.Functor)
  export const apPar = eitherT.ap(cOperation.ApplyPar)
  export const apSeq = eitherT.ap(cOperation.ApplySeq)
  export const chain = eitherT.chain(cOperation.Monad)
  export const fold = eitherT.matchE(cOperation.Monad)
}

declare module 'fp-ts/HKT' {
  export interface URItoKind2<E, A> {
    readonly [cOperationEither.URI]: cOperationEither.COperationEither<E, A>
  }
}
