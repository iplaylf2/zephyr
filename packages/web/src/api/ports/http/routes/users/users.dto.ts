import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { user } from '../../../../../models/user.js'
import { z } from 'zod'

export namespace users{
  const infosQuery = extendApi(
    z.object({ users: z.array(user.id) }),
  )

  export class InfosQueryDto extends createZodDto(infosQuery) {}

  const info = extendApi(
    user.info.merge(z.object({ id: user.id })),
  )

  export class InfoDto extends createZodDto(info) {}
}
