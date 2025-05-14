import { index, integer, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core'
import { timestamp } from '../column-types/timestamp.js'
import { writable } from '../column-types/writable.js'

export const renewalSchedules = pgTable(
  'renewalSchedules',
  {
    businessId: integer().notNull(),
    businessType: varchar().notNull(),
    purgeThreshold: timestamp().notNull(),
    scheduleBarrier: timestamp().notNull(),
    targetExpiredAt: timestamp().notNull(),
    ...writable,
  },
  table => [
    primaryKey({ columns: [table.businessType, table.businessId] }),
    index().on(table.purgeThreshold.asc()),
    index().on(table.scheduleBarrier.desc()),
  ],
)
