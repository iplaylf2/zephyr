import { ioOperation } from '../../common/fp-effection/io-operation.js'
import { ioStream } from '../../common/fp-effection/io-stream.js'
import { pipe } from 'fp-ts/lib/function.js'

export namespace stream{
  export function fromIOOperation<T>(ioo: ioOperation.IOOperation<T>): ioStream.IOStream<T, void> {
    return ioOperation.Functor.map(
      ioo,
      (x) => {
        const i = [x][Symbol.iterator]()

        return {
          // eslint-disable-next-line require-yield
          *next() { return i.next() },
        }
      },
    )
  }

  export function exhaust<T>(ioo: ioOperation.IOOperation<readonly T[]>): ioStream.IOStream<T, void> {
    return pipe(
      ioStream.repeat(void 0),
      ioStream.chain(() => fromIOOperation(ioo)),
      ioStream.takeLeftWhile((x): x is typeof x => 0 < x.length),
      ioStream.chain(ioStream.fromArray),
    )
  }
}
