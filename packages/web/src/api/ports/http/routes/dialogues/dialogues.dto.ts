import { JsonObject } from 'type-fest'
import { conversationId } from '../../../../../domains/conversation/value-object.js'
import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { userId } from '../../../../../domains/user/value-object.js'
import { z } from 'zod'

export namespace dialogues{
  const dialogueInfo = z.object({
    conversationId: conversationId,
    initiatorId: userId,
    lastMessageId: z.string().nullable(),
    participantId: userId,
  })

  export class DialogueInfoDto extends createZodDto(dialogueInfo) {}

  const dataRecord = z.record(
    extendApi(conversationId, { title: 'dialogue' }),
    z.custom<JsonObject>(),
  )

  export class DataRecordDto extends createZodDto(dataRecord) {}

  const deleteDataRecord = z.record(
    extendApi(conversationId, { title: 'dialogue' }),
    z.string(),
  )

  export class DeleteDataRecordDto extends createZodDto(deleteDataRecord) {}
}
