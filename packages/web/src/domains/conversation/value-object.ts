import { JsonValue } from 'type-fest'
import { z } from 'zod'

export const conversationId = z.number().int().positive()
export type ConversationId = z.infer<typeof conversationId>

export const timestamp = z.number().int().positive()
export type Timestamp = z.infer<typeof timestamp>

export const messageBody = z.object({
  content: z.custom<JsonValue>(),
  type: z.string(),
})
export type MessageBody = z.infer<typeof messageBody>
