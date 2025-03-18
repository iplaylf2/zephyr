import { JsonValue, ReadonlyDeep } from 'type-fest'
import { push } from './push.js'
import { z } from 'zod'

export const notification = z.discriminatedUnion('type', [
  z.object({
    pushes: z.array(push),
    type: z.enum(['subscribe', 'unsubscribe', 'complete']),
  }),
  z.object({ type: z.literal('delete') }),
  z.object({
    content: z.custom<JsonValue>(),
    push,
    type: z.literal('message'),
  }),
])
export type Notification = ReadonlyDeep<z.infer<typeof notification>>
