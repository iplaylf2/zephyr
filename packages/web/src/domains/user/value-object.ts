import { z } from 'zod'

export const userId = z.number().int().positive()
export type UserId = z.infer<typeof userId>

export const timestamp = z.number().int().positive()
export type Timestamp = z.infer<typeof timestamp>
