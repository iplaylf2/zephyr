import { Inject, Injectable } from '@nestjs/common'
import { JsonHash } from './common/json-hash.js'
import { JsonStream } from './common/json-stream.js'
import { RedisClientType } from '@redis/client'
import { RedisService } from '../redis.service.js'
import { Set } from '../commands/set.js'
import { SortedSet } from '../commands/sorted-set.js'
import { conversation } from '../../../models/conversation.js'

@Injectable()
export class ConversationService {
  @Inject()
  private readonly redisService!: RedisService

  public get(type: string) {
    return new Conversations(this.redisService, type)
  }

  public getParticipantConversations(type: string, participant: string) {
    return new Conversation.Participant.Conversations(this.redisService, type, participant)
  }

  public getParticipantConversationsMarked(type: string, participant: string) {
    return new Conversation.Participant.ConversationsMarked(this.redisService, type, participant)
  }

  public getParticipantConversationsProgress(type: string, participant: string) {
    return new Conversation.Participant.ConversationsProgress(this.redisService, type, participant)
  }

  public getParticipants(type: string, conversation: string) {
    return new Conversations.Participants(this.redisService, type, conversation)
  }

  public getRecords(type: string, conversation: number) {
    return Conversations.Records.get(this.redisService, type, conversation)
  }
}

export class Conversations extends SortedSet {
  public override readonly key

  public constructor(public override client: RedisClientType, type: string) {
    super()

    this.key = `sorted-set://${encodeURIComponent(type)}.conversations` as const
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

  export class Participants extends SortedSet {
    public override readonly key

    public constructor(public override client: RedisClientType, type: string, id: string) {
      super()

      this.key = `sorted-set://${encodeURIComponent(type)}.conversations/${encodeURIComponent(id)}/participants` as const
    }
  }
}

export namespace Conversation.Participant{
  export class Conversations extends Set {
    public override readonly key

    public constructor(public override client: RedisClientType, type: string, participant: string) {
      super()

      this.key = `set://${encodeURIComponent(type)}.conversation/participants/${encodeURIComponent(participant)}/conversations` as const
    }
  }

  export class ConversationsProgress extends JsonHash<Record<string, string>> {
    public override readonly key

    public constructor(public override client: RedisClientType, type: string, participant: string) {
      super()

      this.key = `hash://${encodeURIComponent(type)}.conversation/participants/${encodeURIComponent(participant)}/conversations/progress` as const
    }
  }

  export class ConversationsMarked extends JsonHash<Record<string, string>> {
    public override readonly key

    public constructor(public override client: RedisClientType, type: string, participant: string) {
      super()

      this.key = `hash://${encodeURIComponent(type)}.conversation/participants/${encodeURIComponent(participant)}/conversations/marked` as const
    }
  }
}
