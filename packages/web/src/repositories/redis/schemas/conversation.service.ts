import { Inject, Injectable } from '@nestjs/common'
import { JsonStream } from '../common-schema/json-stream.js'
import { JsonValue } from 'type-fest'
import { RedisClientType } from '@redis/client'
import { RedisCommandArgument } from '../commands/common.js'
import { RedisService } from '../redis.service.js'
import { z } from 'zod'

@Injectable()
export class ConversationService {
  @Inject()
  private readonly redisService!: RedisService

  public getRecords(type: string, conversationId: number) {
    return Conversations.RecordsSchema.get(this.redisService, type, conversationId)
  }
}

export namespace Conversations{
  export const message = z.object({
    content: z.custom<JsonValue>(),
    group: z.string(),
    sender: z.number(),
    timestamp: z.number(),
    type: z.string(),
  })

  export type Message = z.infer<typeof message>

  export class RecordsSchema<const Key extends string> extends JsonStream<Message> {
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
      return message.parse(super.decode(x))
    }

    protected override duplicate() {
      return new RecordsSchema(this.client.duplicate(), this.key)
    }
  }
}
