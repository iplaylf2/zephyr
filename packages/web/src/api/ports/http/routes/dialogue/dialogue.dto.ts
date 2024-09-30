import { createZodDto } from '@anatine/zod-nestjs'
import { user } from '../../../../../models/user.js'
import { z } from 'zod'

export namespace dialogue{
  const creation = z.object({
    participant: user.id,
  })

  export class CreationDto extends createZodDto(creation) {}
}
