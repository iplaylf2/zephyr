import { z } from 'zod'

export function zPlus<Schema extends z.ZodSchema>(schema: Schema) {
  return {
    parse(data: z.infer<Schema>): z.infer<Schema> {
      return schema.parse(data)
    },
  }
}
