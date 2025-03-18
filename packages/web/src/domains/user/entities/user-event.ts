import { timestamp, userId } from '../value-object.js'
import { ReadonlyDeep } from 'type-fest'
import { z } from 'zod'

export const userEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('expire'),
    users: z.array(
      z.object({
        expiredAt: timestamp,
        id: userId,
      }),
    ),
  }),
  z.object({
    timestamp,
    type: z.literal('register'),
    user: userId,
  }),
  z.object({
    timestamp,
    type: z.literal('unregister'),
    users: z.array(userId),
  }),
])
export type UserEvent = ReadonlyDeep<z.infer<typeof userEvent>>
