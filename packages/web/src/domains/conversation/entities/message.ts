import { messageBody, timestamp } from '../value-object.js'
import { userId } from '../../user/value-object.js'
import { z } from 'zod'

export const message = z.object({
  content: messageBody.shape.content,
  group: z.string(),
  id: z.string(),
  sender: userId,
  timestamp,
  type: messageBody.shape.type,
})
export type Message = Readonly<z.infer<typeof message>>
