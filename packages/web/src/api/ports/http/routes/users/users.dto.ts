import { createZodDto } from '@anatine/zod-nestjs'
import { userId } from '../../../../../domains/user/value-object.js'
import { userInfo } from '../../../../../domains/user/entities/user-info.js'
import { z } from 'zod'

export namespace users{
  const infosQuery = z.object({ users: z.array(userId) })

  export class InfosQueryDto extends createZodDto(infosQuery) {}

  const info = userInfo

  export class InfoDto extends createZodDto(info) {}
}
