import { JsonValue, ReadonlyDeep } from 'type-fest'
import { user } from './user.js'
import { z } from 'zod'

export namespace receiver{
  const id = z.string()

  export const receiver = z.object({
    claim: user.id.nullable(),
  })

  export type Receiver = Readonly<z.infer<typeof receiver>>

  export const notification = z.object({
    data: z.string().transform(x => JSON.parse(x) as JsonValue),
    receiver: id,
    type: z.enum(['subscribe', 'unsubscribe', 'claim', 'unclaim']),
  })

  export type Notification = Readonly<z.infer<typeof notification>>

  export const subscriptions = z.record(
    z.string(),
    z.record(z.string(), z.custom<JsonValue>()),
  )

  export type Subscriptions = ReadonlyDeep<z.infer<typeof subscriptions>>
}
