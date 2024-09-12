import { Conversations } from '../../repositories/redis/entities/conversation.service.js'
import { conversation } from '../../models/conversation.js'

export class Participant {
  public constructor(public readonly id: number, public readonly group: string) {}

  public say(body: conversation.MessageBody): Conversations.Message {
    return { ...body, group: this.group, sender: this.id, timestamp: Date.now() }
  }
}
