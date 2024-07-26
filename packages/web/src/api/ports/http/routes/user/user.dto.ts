import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { user as modelUser } from '../../../../../models/user.js'
import { z } from 'zod'

export namespace user{
  const creationData = extendApi(
    modelUser.info.omit({ group: true }),
  )

  export class CreationDataDto extends createZodDto(creationData) {}

  const creationResult = z.object({
    id: modelUser.id,
    token: extendApi(z.string(), { title: 'passport token' }),
  })

  export class CreationResultDto extends createZodDto(creationResult) {}

  const info = extendApi(
    modelUser.info,
  )

  export class InfoDto extends createZodDto(info) {}

  const updateData = extendApi(
    modelUser.info.omit({ group: true }),
  )

  export class UpdateDataDto extends createZodDto(updateData) {}
}
