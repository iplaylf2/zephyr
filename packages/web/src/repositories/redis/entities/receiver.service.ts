import { Inject, Injectable } from '@nestjs/common'
import { RedisClientType } from '@redis/client'
import { RedisService } from '../redis.service.js'
import { jsonPubSub } from './common/json-pub-sub/shard.js'
import { receiver } from '../../../models/receiver.js'

@Injectable()
export class ReceiverService {
  @Inject()
  private readonly redisService!: RedisService

  public getNotification() {
    return new ReceiverService.Receivers.Notification(this.redisService)
  }
}

export namespace ReceiverService{
  export namespace Receivers{
    export class Notification extends jsonPubSub.Shard<ReturnType<typeof Notification.getChannel>, receiver.Notification> {
      public constructor(public override client: RedisClientType) {
        super()
      }

      public getChannel(receiver: string) {
        return Notification.getChannel(receiver)
      }

      protected override duplicate() {
        return new Notification(this.client.duplicate())
      }
    }

    export namespace Notification{
      export function getChannel(receiver: string) {
        return `s-pub-sub://receivers/${encodeURIComponent(receiver)}/notification` as const
      }
    }
  }
}
