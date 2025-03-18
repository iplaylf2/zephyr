import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { message } from '../../../../../../domains/conversation/entities/message.js'
import { messageBody } from '../../../../../../domains/conversation/value-object.js'
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

  export class MessageDto extends createZodDto(message) {}

  export class MessageBodyDto extends createZodDto(messageBody) {}
}
