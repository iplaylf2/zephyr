import { JsonValue } from 'type-fest'
import { user } from './user.js'
import { z } from 'zod'

export namespace push{
  export const receiver = z.object({
    claimer: user.id.nullable(),
    token: z.string().min(1),
  })

  export type Receiver = Readonly<z.infer<typeof receiver>>

  export const notification = z.object({
    data: z.string().transform(x => JSON.parse(x) as JsonValue),
    type: z.enum(['subscribe', 'unsubscribe', 'claim', 'unclaim']),
  })

  export type Notification = Readonly<z.infer<typeof notification>>

  export const subscription = z.object({
    source: z.number(),
    type: z.string(),
  })

  export type Subscription = Readonly<z.infer<typeof subscription>>
}
