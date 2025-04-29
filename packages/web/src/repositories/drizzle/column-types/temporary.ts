import { ExtraConfigColumn, index } from 'drizzle-orm/pg-core'
import { timestamp } from './timestamp.js'

export const temporary = {
  columns: { expiredAt: timestamp().notNull() },
  createIndex(table: {
    expiredAt: ExtraConfigColumn
  }) {
    return index().on(table.expiredAt)
  },
}
