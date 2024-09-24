import { JsonObject } from 'type-fest'
import { conversation } from '../../../../../../../models/conversation.js'
import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { z } from 'zod'

export namespace groups{
  const group = z.object({
    conversationId: conversation.id,
    lastMessageId: z.string().nullable(),
  })

  export class GroupDto extends createZodDto(group) {}

  const dataRecord = z.record(
    extendApi(conversation.id, { title: 'group' }),
    z.custom<JsonObject>(),
  )

  export class DataRecordDto extends createZodDto(dataRecord) {}

  const deleteDataRecord = z.record(
    extendApi(conversation.id, { title: 'group' }),
    z.string(),
  )

  export class DeleteDataRecordDto extends createZodDto(deleteDataRecord) {}
}
