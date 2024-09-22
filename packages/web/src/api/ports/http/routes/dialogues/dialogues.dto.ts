import { JsonObject } from 'type-fest'
import { conversation } from '../../../../../models/conversation.js'
import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { z } from 'zod'

export namespace dialogues{
  const dialogue = z.object({
    conversationId: conversation.id,
    initiatorId: conversation.id,
    lastMessageId: z.string().nullable(),
    participantId: conversation.id,
  })

  export class DialogueDto extends createZodDto(dialogue) {}

  const dataRecord = z.record(
    extendApi(conversation.id, { title: 'dialogue' }),
    z.custom<JsonObject>(),
  )

  export class DataRecordDto extends createZodDto(dataRecord) {}

  const deleteDataRecord = z.record(
    extendApi(conversation.id, { title: 'dialogue' }),
    z.string(),
  )

  export class DeleteDataRecordDto extends createZodDto(deleteDataRecord) {}
}
