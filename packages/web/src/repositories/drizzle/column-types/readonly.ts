import { Temporal } from 'temporal-polyfill'
import { timestamp } from './timestamp.js'

export const readonly = {
  createdAt: timestamp()
    .$default(() => Temporal.Now.instant())
    .notNull(),
}
