import { Inject, Injectable } from '@nestjs/common'
import { JsonStream } from '../common-schema/json-stream.js'
import { JsonValue } from 'type-fest'
import { RedisClientType } from '@redis/client'
import { RedisCommandArgument } from '../commands/common.js'
import { RedisService } from '../redis.service.js'
import { String } from '../commands/string.js'
import { z } from 'zod'

@Injectable()
export class ConversationService {
  @Inject()
  private readonly redisService!: RedisService

  public getRecords(type: string, conversationId: number) {
    return Conversations.RecordsSchema.get(this.redisService, type, conversationId)
  }

  public getVault(type: string, conversationId: number, participantId: number) {
    return Conversations.VaultSchema.get(this.redisService, type, conversationId, participantId)
  }
}

export namespace Conversations{
  export const record = z.object({
    content: z.custom<JsonValue>(),
    group: z.string(),
    sender: z.number(),
    timestamp: z.number(),
    type: z.string(),
  })

  export type Record = z.infer<typeof record>

  export class RecordsSchema<const Key extends string> extends JsonStream<Record> {
    private constructor(public override client: RedisClientType, public override readonly key: Key) {
      super()
    }

    public static get(client: RedisClientType, type: string, conversationId: number) {
      return new RecordsSchema(
        client,
        `stream://${encodeURIComponent(type)}.conversations/${conversationId.toString()}/records`,
      )
    }

    public override decode(x: RedisCommandArgument) {
      return record.parse(super.decode(x))
    }

    protected override duplicate() {
      return new RecordsSchema(this.client.duplicate(), this.key)
    }
  }

  export class VaultSchema<const Key extends string> extends String<string> {
    private constructor(public override client: RedisClientType, public override readonly key: Key) {
      super()
    }

    public static get(client: RedisClientType, type: string, conversationId: number, participantId: number) {
      return new VaultSchema(
        client,
        `string://${encodeURIComponent(type)}.conversations/${conversationId.toString()}\
        /participants/${participantId.toString()}\
        /vault`,
      )
    }

    public override decode(x: RedisCommandArgument): string {
      return x.toString()
    }

    public override encode(x: string): RedisCommandArgument {
      return x
    }
  }
}
