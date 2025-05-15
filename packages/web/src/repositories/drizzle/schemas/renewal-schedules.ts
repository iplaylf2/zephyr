import { index, integer, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core'
import { temporary } from '../column-types/temporary.js'
import { timestamp } from '../column-types/timestamp.js'
import { writable } from '../column-types/writable.js'

export const renewalSchedules = pgTable(
  'renewalSchedules',
  {
    businessId: integer().notNull(),
    businessType: varchar().notNull(),
    scheduleBarrier: timestamp().notNull(),
    targetExpiresAt: timestamp().notNull(),
    version: integer().default(0).notNull(),
    ...temporary.columns,
    ...writable,
  },
  table => [
    primaryKey({ columns: [table.businessType, table.businessId] }),
    index().on(table.scheduleBarrier.desc()),
    temporary.createIndex(table),
  ],
)
