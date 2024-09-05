import { ioOperation } from '../../common/fp-effection/io-operation.js'
import { ioStream } from '../../common/fp-effection/io-stream.js'
import { pipe } from 'fp-ts/lib/function.js'

export namespace stream{
  export function exhaust<T>(ioo: ioOperation.IOOperation<readonly T[]>): ioStream.IOStream<T, void> {
    return pipe(
      ioStream.repeat(void 0),
      ioStream.chain(() => ioStream.fromIOOperation(ioo)),
      ioStream.takeLeftWhile(x => 0 < x.length),
      ioStream.chain(ioStream.fromArray),
    )
  }
}
