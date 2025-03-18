import { Conversations } from '../../../repositories/redis/schemas/conversation.service.js'
import { MessageBody } from '../value-object.js'

export class Participant {
  public constructor(public readonly id: number, public readonly group: string) {}

  public say(messageBody: MessageBody): Conversations.Message {
    return { ...messageBody, group: this.group, sender: this.id, timestamp: Date.now() }
  }
}

export namespace Participant {
  export const system = new Participant(-1, 'system')
}
