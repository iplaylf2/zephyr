import { Operation, call, useScope } from 'effection'
import { ClientDenyList } from './deny-list.js'
import { Prisma } from '../../generated/index.js'
import { PrismaClient } from '../../client.js'

export const effection = Prisma.defineExtension({
  client: {
    $callTransaction<T, R>(
      this: T,
      fn: (tx: Omit<T, ClientDenyList>) => Operation<R>,
      options?: {
        isolationLevel?: Prisma.TransactionIsolationLevel
        maxWait?: number
        timeout?: number
      },
    ): Operation<R> {
      const client = Prisma.getExtensionContext(this) as unknown as PrismaClient

      return call(
        function*() {
          const scope = yield * useScope()

          return yield * call(
            () => client.$transaction(tx => scope.run(() => fn(tx as Omit<T, ClientDenyList>)), options),
          )
        },
      )
    },
  },
})
