import { Instruction } from 'effection'

export type Directive<T> = Generator<Instruction, T>
export type Procedure<T> = Iterable<Instruction, T> & {
  next?: never
}
export type Plan<T> = () => Directive<T>

export namespace Plan{
  export function toProcedure<T>(plan: Plan<T>): Procedure<T> {
    return {
      [Symbol.iterator]: plan,
    }
  }
}

export namespace Procedure{
  export function toPlan<T>(procedure: Procedure<T>): Plan<T> {
    return function* () {
      return yield* procedure
    }
  }
}
