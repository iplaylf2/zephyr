import { Operation, Yielded, spawn, withResolvers } from 'effection'

export function* merge<O1 extends Operation<unknown>, O2 extends Operation<unknown>>(
  o1: O1,
  o2: O2): Operation<[Yielded<O1>, O2] | [Yielded<O2>, O1]> {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { operation, reject, resolve } = withResolvers<[Yielded<O1>, O2] | [Yielded<O2>, O1]>()

  void (yield * spawn(function*() {
    try {
      const v1 = yield * o1

      resolve([v1 as Yielded<O1>, o2])
    }
    catch (e) {
      reject(e as Error)
    }
  }))

  void (yield * spawn(function*() {
    try {
      const v2 = yield * o2

      resolve([v2 as Yielded<O2>, o1])
    }
    catch (e) {
      reject(e as Error)
    }
  }))

  return yield * operation
}
