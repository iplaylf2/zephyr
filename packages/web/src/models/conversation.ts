import { JsonValue } from 'type-fest'
import { z } from 'zod'

export namespace conversation{
  export const messageBody = z.object({
    content: z.custom<JsonValue>(),
    type: z.string(),
  })

  export type MessageBody = Readonly<z.infer<typeof messageBody>>

  export const message = messageBody.merge(z.object({
    group: z.string(),
    id: z.string(),
    sender: z.string(),
    timestamp: z.number(),
  }))

  export type Message = Readonly<z.infer<typeof message>>
}
