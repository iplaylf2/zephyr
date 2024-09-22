import { Inject, Injectable } from '@nestjs/common'
import { JsonStream } from './common/json-stream.js'
import { RedisClientType } from '@redis/client'
import { RedisService } from '../redis.service.js'
import { conversation } from '../../../models/conversation.js'

@Injectable()
export class ConversationService {
  @Inject()
  private readonly redisService!: RedisService

  public getRecords(type: string, conversation: number) {
    return Conversations.Records.get(this.redisService, type, conversation)
  }
}

export namespace Conversations{
  export type Message = Omit<conversation.Message, 'id'>

  export class Records<const Key extends string> extends JsonStream<Message> {
    private constructor(public override client: RedisClientType, public override readonly key: Key) {
      super()
    }

    public static get(client: RedisClientType, type: string, conversation: number) {
      return new Records(
        client,
        `stream://${encodeURIComponent(type)}.conversations/${conversation.toString()}/records`,
      )
    }

    protected override duplicate() {
      return new Records(this.client.duplicate(), this.key)
    }
  }
}
