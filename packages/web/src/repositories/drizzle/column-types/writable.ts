import { timestamp } from './timestamp.js'

export const writable = {
  createdAt: timestamp().notNull(),
  updatedAt: timestamp().notNull(),
}
