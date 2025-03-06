import { Instruction, Operation } from 'effection'

export type Directive<T> = Generator<Instruction, T>
export type Procedure<T> = Iterable<Instruction, T> & {
  next?: never
}
export type Plan<T> = () => Directive<T>

export namespace Plan{
  export function fromProcedure<T>(procedure: Procedure<T>): Plan<T> {
    return function* () {
      return yield* procedure
    }
  }

  export function fromOperationPlan<T>(plan: () => Operation<T>): Plan<T> {
    return function* () {
      return yield* plan()
    }
  }
}

export namespace Procedure{
  export function fromPlan<T>(plan: Plan<T>): Procedure<T> {
    return {
      [Symbol.iterator]: plan,
    }
  }
}
