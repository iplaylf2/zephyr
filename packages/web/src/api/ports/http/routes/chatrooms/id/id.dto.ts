import { conversation } from '../../../../../../models/conversation.js'
import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { z } from 'zod'

export namespace id{
  const messageQuery = extendApi(z.object({
    end: extendApi(
      z.string().optional(),
      { description: 'include' },
    ),
    start: extendApi(
      z.string().optional(),
      { description: 'include' },
    ),
  }))

  export class MessageQueryDto extends createZodDto(messageQuery) {}

  const _message = extendApi(conversation.message)

  export class MessageDto extends createZodDto(_message) {}

  const messageBody = extendApi(
    conversation.messageBody,
  )

  export class MessageBodyDto extends createZodDto(messageBody) {}
}
