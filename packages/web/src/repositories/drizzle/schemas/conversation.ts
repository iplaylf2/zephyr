import { index, integer, pgTable, primaryKey, serial, uniqueIndex, varchar } from 'drizzle-orm/pg-core'
import { readonly } from '../column-types/readonly.js'
import { relations } from 'drizzle-orm'
import { temporary } from '../column-types/temporary.js'
import { users } from './users.js'

export const conversations = pgTable(
  'conversations',
  {
    id: serial().primaryKey(),
    name: varchar().notNull(),
    type: varchar().notNull(),
    ...readonly,
    ...temporary.columns,
  },
  table => [
    index().on(table.type),
    temporary.createIndex(table),
  ],
)

export const conversationParticipants = pgTable(
  'conversationParticipants',
  {
    conversationId: integer().notNull().references(() => conversations.id),
    participantId: integer().notNull(),
    ...readonly,
    ...temporary.columns,
  },
  table => [
    primaryKey({ columns: [table.conversationId, table.participantId] }),
    uniqueIndex().on(table.participantId, table.conversationId),
    temporary.createIndex(table),
  ],
)

export const conversationsRelations = relations(
  conversations,
  ({ many }) => ({
    participants: many(conversationParticipants),
  }),
)

export const conversationParticipantsRelations = relations(
  conversationParticipants,
  ({ one }) => ({
    conversation: one(
      conversations,
      {
        fields: [conversationParticipants.conversationId],
        references: [conversations.id],
      },
    ),
    participant: one(
      users,
      {
        fields: [conversationParticipants.participantId],
        references: [users.id],
      },
    ),
  }),
)
