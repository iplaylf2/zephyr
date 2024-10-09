import { ReadonlyDeep } from 'type-fest'
import { user } from './user.js'
import { z } from 'zod'

export namespace push{
  export const receiver = z.object({
    claimer: user.id.nullable(),
    token: z.string().min(1),
  })

  export type Receiver = Readonly<z.infer<typeof receiver>>

  export const notification = z.object({
    push: z.object({
      sources: z.array(z.number()),
      type: z.string(),
    }),
    type: z.enum(['subscribe', 'unsubscribe']),
  })

  export type Notification = ReadonlyDeep<z.infer<typeof notification>>
}
