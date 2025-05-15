import { Temporal } from 'temporal-polyfill'
import { timestamp } from './timestamp.js'

export const writable = {
  createdAt: timestamp()
    .$default(() => Temporal.Now.instant())
    .notNull(),
  updatedAt: timestamp()
    .$default(() => Temporal.Now.instant())
    .notNull()
    .$onUpdate(() => Temporal.Now.instant()),
}
