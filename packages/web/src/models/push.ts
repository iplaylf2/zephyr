import { JsonValue, ReadonlyDeep } from 'type-fest'
import { user } from './user.js'
import { z } from 'zod'

export namespace push{
  export const receiver = z.object({
    claimer: user.id.nullable(),
    token: z.string().min(1),
  })

  export type Receiver = Readonly<z.infer<typeof receiver>>

  export const push = z.object({
    source: z.number(),
    type: z.string(),
  })

  export type Push = Readonly<z.infer<typeof push>>

  const notificationItem = [
    z.object({
      pushes: z.array(push),
      type: z.enum(['subscribe', 'unsubscribe', 'complete']),
    }),
    z.object({ type: z.literal('delete') }),
  ] as const

  export const notification = z.discriminatedUnion('type', notificationItem)

  export type Notification = ReadonlyDeep<z.infer<typeof notification>>

  export const message = z.discriminatedUnion('type', [
    ...notificationItem,
    z.object({
      content: z.custom<JsonValue>(),
      push,
      type: z.literal('message'),
    }),
  ])

  export type Message = ReadonlyDeep<z.infer<typeof message>>
}
