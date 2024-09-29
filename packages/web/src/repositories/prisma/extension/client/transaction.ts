import { Operation, call, useScope } from 'effection'
import { ClientDenyList } from './deny-list.js'
import { Prisma } from '../../generated/index.js'
import { PrismaClient } from '../../client.js'

export const effection = Prisma.defineExtension({
  client: {
    *$callTransaction<T, R>(
      this: T,
      operation: (tx: Omit<T, ClientDenyList>) => Operation<R>,
      options?: {
        isolationLevel?: Prisma.TransactionIsolationLevel
        maxWait?: number
        timeout?: number
      },
    ): Operation<R> {
      const client = Prisma.getExtensionContext(this) as unknown as PrismaClient

      const scope = yield * useScope()

      return yield * call(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        client.$transaction(tx => scope.run(() => operation(tx as any)), options),
      )
    },
  },
})
