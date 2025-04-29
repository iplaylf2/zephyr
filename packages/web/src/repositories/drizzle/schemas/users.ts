import { pgTable, serial, varchar } from 'drizzle-orm/pg-core'
import { readonly } from '../column-types/readonly.js'
import { temporary } from '../column-types/temporary.js'

export const users = pgTable(
  'users',
  {
    id: serial().primaryKey(),
    name: varchar().notNull(),
    ...readonly,
    ...temporary.columns,
  },
  table => [
    temporary.createIndex(table),
  ],
)
