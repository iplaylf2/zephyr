import {
  applicative, apply, chain, either, eitherT, fromIO, fromTask,
  functor, monad, monadIO, monadTask, pointed, task,
  taskEither,
} from 'fp-ts'
import { operation } from './operation.js'
import { pipe } from 'fp-ts/lib/function.js'

export namespace operationEither{
  export type OperationEither<E, A> = operation.Operation<either.Either<E, A>>
  export const URI = 'operationEither.effection'
  export type URI = typeof URI
  export type Infer<T extends OperationEither<unknown, unknown>> = T extends OperationEither<infer E, infer A> ?
      [E, A]
    : unknown

  export const Functor: functor.Functor2<URI> = {
    URI,
    map: (fa, f) => map(f)(fa),
  }

  export const Pointed: pointed.Pointed2<URI> = {
    URI,
    of: eitherT.right(operation.Pointed),
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
    // eslint-disable-next-line require-yield
    fromIO: function*(fa) {
      return either.right(fa())
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
      operation.FromTask.fromTask(fa),
      operation.chain(Pointed.of<E, A>),
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

  export function fromOperation<A>(a: operation.Operation<A>): OperationEither<void, A> {
    return operation.chain(Pointed.of)(a)
  }

  export function fromTaskEither<E, A>(a: taskEither.TaskEither<E, A>): OperationEither<E, A> {
    return operation.FromTask.fromTask(a)
  }

  export function *tryCatch<E, A>(
    f: operation.Operation<A>,
    onRejected: (reason: unknown) => E,
  ): OperationEither<E, A> {
    try {
      return either.right(yield * f)
    }
    catch (e) {
      return either.left(onRejected(e))
    }
  }

  export const map = eitherT.map(operation.Functor)
  export const apPar = eitherT.ap(operation.ApplyPar)
  export const apSeq = eitherT.ap(operation.ApplySeq)
  export const chain = eitherT.chain(operation.Monad)
  export const fold = eitherT.matchE(operation.Monad)
}

declare module 'fp-ts/HKT' {
  export interface URItoKind2<E, A> {
    readonly [operationEither.URI]: operationEither.OperationEither<E, A>
  }
}
