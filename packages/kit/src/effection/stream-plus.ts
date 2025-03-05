import { pipe } from 'fp-ts/lib/function.js'
import { plan } from '../fp-effection/plan.js'
import { stream } from '../fp-effection/stream.js'

export namespace streamPlus{
  export function generate<T>(generator: plan.Plan<readonly T[]>): stream.Stream<T, void> {
    return pipe(
      stream.repeat(void 0),
      stream.chain(() => stream.fromPlan(generator)),
      stream.chain(stream.fromArray),
    )
  }
}
