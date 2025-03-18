import { conversationId } from '../value-object.js'
import { z } from 'zod'

export const conversationInfo = z.object({
  id: conversationId,
  name: z.string().min(1),
})
export type ConversationInfo = Readonly<z.infer<typeof conversationInfo>>
