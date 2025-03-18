import { createZodDto } from '@anatine/zod-nestjs'
import { userId } from '../../../../../domains/user/value-object.js'
import { z } from 'zod'

export namespace dialogue{
  const creation = z.object({
    participantId: userId,
  })

  export class CreationDto extends createZodDto(creation) {}
}
