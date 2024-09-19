import { ReadonlyDeep } from 'type-fest'
import { z } from 'zod'

export namespace user{
  export const id = z.number().int().nonnegative()

  const eventData = z.object({
    timestamp: z.number(),
  })

  export const event = z.discriminatedUnion('type', [
    z.object({
      data: eventData.merge(z.object({
        expire: z.number(),
      })),
      type: z.literal('expire'),
      users: z.array(id),
    }),
    z.object({
      data: eventData.merge(z.object({
        expire: z.number(),
      })),
      type: z.literal('register'),
      user: id,
    }),
    z.object({
      data: eventData,
      type: z.literal('unregister'),
      users: z.array(id),
    }),

  ])

  export type Event = ReadonlyDeep<z.infer<typeof event>>

  export const info = z.object({
    name: z.string().min(1),
  })

  export type Info = Readonly<z.infer<typeof info>>
}
