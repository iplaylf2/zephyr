import { JsonValue } from 'type-fest'
import { z } from 'zod'

export namespace message{
  export const body = z.object({
    content: z.custom<JsonValue>(),
    type: z.string(),
  })

  export type Body = Readonly<z.infer<typeof body>>

  export const message = body.merge(z.object({
    group: z.string(),
    id: z.string(),
    sender: z.string(),
    timestamp: z.number(),
  }))

  export type Message = Readonly<z.infer<typeof message>>
}
