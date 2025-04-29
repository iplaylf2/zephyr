import { integer, pgTable, uniqueIndex } from 'drizzle-orm/pg-core'
import { conversations } from './conversation.js'
import { relations } from 'drizzle-orm'
import { temporary } from '../column-types/temporary.js'
import { users } from './users.js'

export const dialogues = pgTable(
  'dialogues',
  {
    conversationId: integer().notNull().primaryKey(),
    initiatorId: integer().notNull(),
    participantId: integer().notNull(),
    ...temporary.columns,
  },
  table => [
    uniqueIndex().on(table.initiatorId, table.participantId),
    uniqueIndex().on(table.participantId, table.initiatorId),
    temporary.createIndex(table),
  ],
)

export const dialoguesRelations = relations(
  dialogues,
  ({ one }) => ({
    conversation: one(
      conversations,
      {
        fields: [dialogues.conversationId],
        references: [conversations.id],
      },
    ),
    initiator: one(
      users,
      {
        fields: [dialogues.initiatorId],
        references: [users.id],
      },
    ),
    participant: one(
      users,
      {
        fields: [dialogues.participantId],
        references: [users.id],
      },
    ),
  }),
)
