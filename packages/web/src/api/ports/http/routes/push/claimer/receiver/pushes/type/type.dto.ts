import { createZodDto } from '@anatine/zod-nestjs'
import { z } from 'zod'

export namespace type{
  const pushes = z.array(z.number().int().positive())

  export class PushesDto extends createZodDto(pushes) {}
}
