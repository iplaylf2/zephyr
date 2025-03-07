import { z } from 'zod'

export function zPlus<Schema extends z.ZodSchema>(schema: Schema) {
  return {
    parse<T = z.infer<Schema>>(data: NoInfer<T>): NoInfer<T> {
      return schema.parse(data)
    },
  }
}
