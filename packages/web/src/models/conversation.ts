import { JsonValue } from 'type-fest'
import { user } from './user.js'
import { z } from 'zod'

export namespace conversation{
  export const id = z.number().int().nonnegative()

  export const info = z.object({
    name: z.string().min(1),
  })

  export type Info = Readonly<z.infer<typeof info>>

  export const messageBody = z.object({
    content: z.custom<JsonValue>(),
    type: z.string(),
  })

  export type MessageBody = Readonly<z.infer<typeof messageBody>>

  export const message = messageBody.merge(z.object({
    group: z.string(),
    id: z.string(),
    sender: user.id,
    timestamp: z.number(),
  }))

  export type Message = Readonly<z.infer<typeof message>>
}
