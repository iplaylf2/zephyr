import { timestamp, userId } from '../value-object.js'
import { ReadonlyDeep } from 'type-fest'
import { z } from 'zod'

export const userEvent = z.discriminatedUnion('type', [
  z.object({
    expiredAt: timestamp,
    type: z.literal('expire'),
    users: z.array(userId),
  }),
  z.object({
    timestamp,
    type: z.literal('unregister'),
    users: z.array(userId),
  }),
])
export type UserEvent = ReadonlyDeep<z.infer<typeof userEvent>>
