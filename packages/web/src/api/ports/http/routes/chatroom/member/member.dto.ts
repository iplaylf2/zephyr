import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { z } from 'zod'

export namespace member{
  const chatroom = z.object({
    conversationId: z.string(),
    lastMessageId: z.string().nullable(),
  })

  export class ChatroomDto extends createZodDto(chatroom) {}

  const progressRecord = z.record(
    extendApi(z.string(), { title: 'conversation' }),
    z.string(),
  )

  export class ProgressRecordDto extends createZodDto(progressRecord) {}

  const conversations = z.array(z.string())

  export class ConversationsDto extends createZodDto(conversations) {}
}
