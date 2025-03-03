import { operation } from '../fp-effection/operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { stream } from '../fp-effection/stream.js'

export namespace streamPlus{
  export function generate<T>(generator: () => operation.Operation<readonly T[]>): stream.Stream<T, void> {
    return pipe(
      stream.repeat(void 0),
      stream.chain(() => stream.fromOperation(generator())),
      stream.chain(stream.fromArray),
    )
  }
}
