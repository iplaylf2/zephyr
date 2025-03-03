import { Operation, Task, useScope, withResolvers } from 'effection'

export function* merge<T1, T2>(
  o1: Operation<T1>,
  o2: Operation<T2>): Operation<[T1, Task<T2>] | [T2, Task<T1>]> {
  const scope = yield * useScope()

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { operation, reject, resolve } = withResolvers<[T1, Task<T2>] | [T2, Task<T1>]>()

  const task1 = scope.run(() => o1)
  const task2 = scope.run(() => o2)

  void task1.then((v1) => {
    resolve([v1, task2])
  })
  task1.catch(reject)

  void task2.then((v2) => {
    resolve([v2, task1])
  })
  task2.catch(reject)

  return yield * operation
}
