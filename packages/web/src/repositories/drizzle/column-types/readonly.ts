import { timestamp } from './timestamp.js'

export const readonly = {
  createdAt: timestamp().notNull(),
}
