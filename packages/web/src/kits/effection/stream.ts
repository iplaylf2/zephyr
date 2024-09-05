import { Operation, Stream } from 'effection'

export namespace stream{
  // eslint-disable-next-line require-yield
  export function *exhaust<T>(f: () => Operation<readonly T[]>): Stream<T, void> {
    let count = 0
    let cache: readonly T[] = []
    let done = false

    return {
      next: function *next() {
        if (done) {
          return { done: true, value: void 0 }
        }

        if (count < cache.length) {
          return { value: cache[count++]! }
        }

        cache = yield * f()

        if (0 === cache.length) {
          done = true
        }
        else {
          count = 0
        }

        return next()
      },
    }
  }
}
