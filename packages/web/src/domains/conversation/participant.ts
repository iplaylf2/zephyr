import { Conversations } from '../../repositories/redis/entities/conversation.service.js'
import { message } from '../../models/message.js'

export class Participant {
  public constructor(public readonly id: string, public readonly group: string) {}

  public say(body: message.Body): Conversations.Message {
    return { ...body, group: this.group, sender: this.id, timestamp: Date.now() }
  }
}
