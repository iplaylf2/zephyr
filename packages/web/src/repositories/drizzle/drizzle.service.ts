/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import * as conversation from './schemas/conversation.js'
import * as dialogues from './schemas/dialogues.js'
import * as push from './schemas/push.js'
import * as renewalSchedules from './schemas/renewal-schedules.js'
import * as users from './schemas/users.js'
import { Operation, resource, scoped, until, useScope } from 'effection'
import { PgDatabase, PgTransaction, PgTransactionConfig } from 'drizzle-orm/pg-core'
import { Directive } from '@zephyr/kit/effection/operation.js'
import { FactoryProvider } from '@nestjs/common'
import { Pool } from 'pg'
import { ResourceManagerService } from '../../common/resource-manager/resource-manager.service.js'
import { drizzle } from 'drizzle-orm/node-postgres'
import { env } from '../../env.js'

function useFactory(resourceManagerService: ResourceManagerService) {
  return resourceManagerService.provide(
    () => {
      const pool = new Pool({ connectionString: env.drizzle.databaseUrl })

      const client = drizzle({
        client: pool,
        schema: {
          ...conversation,
          ...dialogues,
          ...push,
          ...renewalSchedules,
          ...users,
        },
      })

      return resource<typeof client>(function* (provide) {
        try {
          yield* provide(client)
        }
        finally {
          yield* until(pool.end())
        }
      })
    },
  )
}

type DrizzleClient = Awaited<ReturnType<typeof useFactory>>

export interface DrizzleService extends DrizzleClient {}
export abstract class DrizzleService {}

export const drizzleProvider = {
  inject: [ResourceManagerService],
  provide: DrizzleService,
  useFactory,
} satisfies FactoryProvider

type DrizzleTransaction = DrizzleClient extends PgDatabase<
  infer TQueryResult,
  infer TFullSchema,
  infer TSchema>
  ? PgTransaction<TQueryResult, TFullSchema, TSchema>
  : unknown

export function* $transaction<R>(
  client: DrizzleClient,
  transaction: (tx: DrizzleTransaction) => Operation<R>,
  config?: PgTransactionConfig,
): Directive<R> {
  return yield* scoped(
    function* () {
      const scope = yield* useScope()

      return yield* until(
        client.transaction(
          tx => scope.run(() => transaction(tx)),
          config,
        ),
      )
    },
  )
}
