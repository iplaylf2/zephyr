import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { z } from 'zod'

export namespace member{
  const chatroom = extendApi(z.object({
    conversationId: z.string(),
    lastMessageId: z.string().nullable(),
  }))

  export class ChatroomDto extends createZodDto(chatroom) {}
}
