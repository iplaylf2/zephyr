import { userId } from '../value-object.js'
import { z } from 'zod'

export const userInfo = z.object({
  id: userId,
  name: z.string().min(1),
})
export type UserInfo = Readonly<z.infer<typeof userInfo>>
