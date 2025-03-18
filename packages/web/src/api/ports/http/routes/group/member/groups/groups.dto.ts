import { JsonObject } from 'type-fest'
import { conversationId } from '../../../../../../../domains/conversation/value-object.js'
import { createZodDto } from '@anatine/zod-nestjs'
import { extendApi } from '@anatine/zod-openapi'
import { z } from 'zod'

export namespace groups{
  const groupInfo = z.object({
    conversationId: conversationId,
    lastMessageId: z.string().nullable(),
  })

  export class GroupInfoDto extends createZodDto(groupInfo) {}

  const dataRecord = z.record(
    extendApi(conversationId, { title: 'group' }),
    z.custom<JsonObject>(),
  )

  export class DataRecordDto extends createZodDto(dataRecord) {}

  const deleteDataRecord = z.record(
    extendApi(conversationId, { title: 'group' }),
    z.string(),
  )

  export class DeleteDataRecordDto extends createZodDto(deleteDataRecord) {}
}
