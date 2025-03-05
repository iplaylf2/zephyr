import { Directive, Procedure } from './operation.js'
import { Operation, useScope, withResolvers } from 'effection'

export function* merge<T1, T2>(
  o1: () => Operation<T1>,
  o2: () => Operation<T2>): Directive<[T1, Procedure<T2>] | [T2, Procedure<T1>]> {
  const scope = yield* useScope()

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { operation, reject, resolve } = withResolvers<[T1, Procedure<T2>] | [T2, Procedure<T1>]>()

  const task1 = scope.run(o1)
  const task2 = scope.run(o2)

  void task1.then((v1) => {
    resolve([v1, task2])
  })
  task1.catch((e: unknown) => {
    reject(e as never)
  })

  void task2.then((v2) => {
    resolve([v2, task1])
  })
  task2.catch((e: unknown) => {
    reject(e as never)
  })

  return yield* operation
}
