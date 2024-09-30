import { cOperation } from '../../common/fp-effection/c-operation.js'
import { cStream } from '../../common/fp-effection/c-stream.js'
import { pipe } from 'fp-ts/lib/function.js'

export namespace stream{
  export function exhaust<T>(ioo: cOperation.COperation<readonly T[]>): cStream.CStream<T, void> {
    return pipe(
      cStream.repeat(void 0),
      cStream.chain(() => cStream.fromCOperation(ioo)),
      cStream.takeLeftWhile(x => 0 < x.length),
      cStream.chain(cStream.fromArray),
    )
  }
}
