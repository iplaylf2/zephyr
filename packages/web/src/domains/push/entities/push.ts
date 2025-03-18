import { z } from 'zod'

export const push = z.object({
  source: z.number(),
  type: z.string(),
})
export type Push = Readonly<z.infer<typeof push>>
