import { integer, pgTable, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { timestamp } from '../column-types/timestamp.js'
import { writable } from '../column-types/writable.js'

export const renewalTasks = pgTable(
  'renewalTasks',
  {
    businessExpiredAt: timestamp().notNull(),
    businessId: integer().notNull(),
    businessType: varchar().notNull(),
    count: integer().notNull(),
    ...writable,
  },
  table => [
    primaryKey({ columns: [table.businessType, table.businessId] }),
    uniqueIndex().on(table.businessId, table.businessType),
  ],
)
