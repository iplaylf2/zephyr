import { ExtraConfigColumn, index } from 'drizzle-orm/pg-core'
import { timestamp } from './timestamp.js'

export const temporary = {
  columns: { expiresAt: timestamp().notNull() },
  createIndex(table: {
    expiresAt: ExtraConfigColumn
  }) {
    return index().on(table.expiresAt.asc())
  },
}
