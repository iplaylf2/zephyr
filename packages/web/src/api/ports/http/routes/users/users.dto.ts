import { createZodDto } from '@anatine/zod-nestjs'
import { user } from '../../../../../models/user.js'
import { z } from 'zod'

export namespace users{
  const infosQuery = z.object({ users: z.array(user.id) })

  export class InfosQueryDto extends createZodDto(infosQuery) {}

  const info = user.info.merge(z.object({ id: user.id }))

  export class InfoDto extends createZodDto(info) {}
}
