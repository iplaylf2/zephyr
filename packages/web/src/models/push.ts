import { JsonValue, ReadonlyDeep } from 'type-fest'
import { user } from './user.js'
import { z } from 'zod'

export namespace push{
  export const receiver = z.object({
    claimer: user.id.nullable(),
    token: z.string().min(1),
  })

  export type Receiver = Readonly<z.infer<typeof receiver>>

  const notificationItem = [
    z.object({
      push: z.object({
        sources: z.array(z.number()),
        type: z.string(),
      }),
      type: z.enum(['subscribe', 'unsubscribe']),
    }),
    z.object({ type: z.literal('delete') }),
  ] as const

  export const notification = z.discriminatedUnion('type', [...notificationItem])

  export type Notification = ReadonlyDeep<z.infer<typeof notification>>

  export const Message = z.discriminatedUnion('type', [
    ...notificationItem,
    z.object({
      content: z.custom<JsonValue>(),
      type: z.literal('message'),
    }),
  ])

  export type Message = ReadonlyDeep<z.infer<typeof Message>>
}
