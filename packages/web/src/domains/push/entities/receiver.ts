import { userId } from '../../user/value-object.js'
import { z } from 'zod'

export const receiver = z.object({
  claimer: userId.nullable(),
  token: z.string().min(1),
})
export type Receiver = Readonly<z.infer<typeof receiver>>
