import { JsonValue } from 'type-fest'
import { user } from './user.js'
import { z } from 'zod'

export namespace push{
  export const id = z.number().int().nonnegative()

  export const receiver = z.object({
    claim: user.id.nullable(),
    token: z.string().min(1),
  })

  export type Receiver = Readonly<z.infer<typeof receiver>>

  export const notification = z.object({
    data: z.string().transform(x => JSON.parse(x) as JsonValue),
    receiver: id,
    type: z.enum(['subscribe', 'unsubscribe', 'claim', 'unclaim']),
  })

  export type Notification = Readonly<z.infer<typeof notification>>
}
