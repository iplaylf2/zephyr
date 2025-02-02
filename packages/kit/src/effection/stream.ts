import { cOperation } from '../fp-effection/c-operation.js'
import { cStream } from '../fp-effection/c-stream.js'
import { pipe } from 'fp-ts/lib/function.js'

export namespace stream{
  export function generate<T>(ioo: cOperation.COperation<readonly T[]>): cStream.CStream<T, void> {
    return pipe(
      cStream.repeat(void 0),
      cStream.chain(() => cStream.fromCOperation(ioo)),
      cStream.chain(cStream.fromArray),
    )
  }
}
