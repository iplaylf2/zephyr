import { integer, pgTable, primaryKey, serial, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { readonly } from '../column-types/readonly.js'
import { relations } from 'drizzle-orm'
import { temporary } from '../column-types/temporary.js'
import { users } from './users.js'
import { writable } from '../column-types/writable.js'

export const pushes = pgTable(
  'pushes',
  {
    businessId: integer().notNull(),
    businessType: varchar().notNull(),
    id: serial().primaryKey(),
    ...readonly,
    ...temporary.columns,
  },
  table => [
    uniqueIndex().on(table.businessType, table.businessId),
    uniqueIndex().on(table.businessId, table.businessType),
    temporary.createIndex(table),
  ],
)

export const pushReceivers = pgTable(
  'pushReceivers',
  {
    claimerId: integer().unique(),
    id: serial().primaryKey(),
    token: uuid().notNull().unique(),
    ...temporary.columns,
    ...writable,
  },
  table => [
    temporary.createIndex(table),
  ],
)

export const pushSubscriptions = pgTable(
  'pushSubscriptions',
  {
    pushId: integer().notNull().references(() => pushes.id),
    receiverId: integer().notNull().references(() => pushReceivers.id),
    ...readonly,
  },
  table => [
    primaryKey({ columns: [table.pushId, table.receiverId] }),
    uniqueIndex().on(table.receiverId, table.pushId),
  ],
)

export const pushesRelations = relations(
  pushes,
  ({ many }) => ({
    subscriptions: many(pushSubscriptions),
  }),
)

export const pushReceiversRelations = relations(
  pushReceivers,
  ({ many, one }) => ({
    claimer: one(
      users,
      {
        fields: [pushReceivers.claimerId],
        references: [users.id],
      },
    ),
    subscriptions: many(pushSubscriptions),
  }),
)

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    push: one(
      pushes,
      {
        fields: [pushSubscriptions.pushId],
        references: [pushes.id],
      },
    ),
    receiver: one(
      pushReceivers,
      {
        fields: [pushSubscriptions.receiverId],
        references: [pushReceivers.id],
      },
    ),
  }),
)
