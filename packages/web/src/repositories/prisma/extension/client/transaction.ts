import { Operation, call, scoped, useScope } from 'effection'
import { ClientDenyList } from './deny-list.js'
import { Directive } from '@zephyr/kit/effection/operation.js'
import { Prisma } from '../../generated/index.js'
import { PrismaClient } from '../../client.js'

export const effection = Prisma.defineExtension({
  client: {
    * $callTransaction<T, R>(
      this: T,
      fn: (tx: Omit<T, ClientDenyList>) => Operation<R>,
      options?: {
        isolationLevel?: Prisma.TransactionIsolationLevel
        maxWait?: number
        timeout?: number
      },
    ): Directive<R> {
      const client = Prisma.getExtensionContext(this) as unknown as PrismaClient

      return yield* scoped(
        function* () {
          const scope = yield* useScope()

          return yield* call(
            () => client.$transaction(tx => scope.run(() => fn(tx as Omit<T, ClientDenyList>)), options),
          )
        },
      )
    },
  },
})
