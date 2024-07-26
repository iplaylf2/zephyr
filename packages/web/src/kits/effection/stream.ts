import { Operation, Stream } from 'effection'

export namespace stream{
  // eslint-disable-next-line require-yield
  export function *exhaust<T>(f: () => Operation<readonly T[]>): Stream<T, void> {
    let count = 0
    let cache: readonly T[] = []

    return {
      *next() {
        if (count === cache.length) {
          cache = yield * f()

          if (0 === cache.length) {
            return { done: true, value: undefined }
          }
        }

        return { value: cache[count++]! }
      },
    }
  }

  export function *concat<Close, T extends [Stream<any, Close>, ...Stream<any, Close>[]]>(...streams: T): Stream<ValueOfStream<T[number]>, Close> {
    let index = 0
    let subscription = yield * streams[index]!

    return {
      *next() {
        while (true) {
          const result = yield * subscription.next()

          if (undefined === result.done) {
            return result
          }

          index++

          if (index === streams.length) {
            return result
          }

          subscription = yield * streams[index]!
        }
      },
    }
  }

  export type ValueOfStream<T extends Stream<any, any>> = T extends Stream<infer V, any> ? V : never
}
