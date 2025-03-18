import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { userId } from '../../../../../domains/user/value-object.js'
import { userInfo } from '../../../../../domains/user/entities/user-info.js'
import { z } from 'zod'

export namespace user{
  const creationResult = z.object({
    id: userId,
    token: extendApi(z.string(), { title: 'passport token' }),
  })

  export class CreationResultDto extends createZodDto(creationResult) {}

  const info = userInfo.omit({ id: true })

  export class InfoDto extends createZodDto(info) {}
}
