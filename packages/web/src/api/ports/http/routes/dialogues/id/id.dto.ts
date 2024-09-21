import { conversation } from '../../../../../../models/conversation.js'
import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { z } from 'zod'

export namespace id{
  const messageQuery = z.object({
    end: extendApi(
      z.string().optional(),
      { description: 'include' },
    ),
    start: extendApi(
      z.string().optional(),
      { description: 'include' },
    ),
  })

  export class MessageQueryDto extends createZodDto(messageQuery) {}

  export class MessageDto extends createZodDto(conversation.message) {}

  export class MessageBodyDto extends createZodDto(conversation.messageBody) {}
}
