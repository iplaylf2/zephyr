import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { user as modelUser } from '../../../../../models/user.js'
import { z } from 'zod'

export namespace user{
  const creationResult = z.object({
    id: modelUser.id,
    token: extendApi(z.string(), { title: 'passport token' }),
  })

  export class CreationResultDto extends createZodDto(creationResult) {}

  export class InfoDto extends createZodDto(modelUser.info) {}
}
