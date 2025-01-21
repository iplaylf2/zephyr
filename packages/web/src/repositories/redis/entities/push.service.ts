import { Inject, Injectable } from '@nestjs/common'
import { RedisClientType } from '@redis/client'
import { RedisService } from '../redis.service.js'
import { jsonPubSub } from './common/json-pub-sub/shard.js'
import { push } from '../../../models/push.js'

@Injectable()
export class PushService {
  @Inject()
  private readonly redisService!: RedisService

  public getNotification() {
    return new PushService.Notification(this.redisService)
  }
}

export namespace PushService{
  export class Notification
    extends jsonPubSub.Shard<ReturnType<typeof Notification.getChannel>, push.Notification> {
    public constructor(public override client: RedisClientType) {
      super()
    }

    public getChannel(receiverId: number) {
      return Notification.getChannel(receiverId)
    }

    protected override duplicate() {
      return new Notification(this.client.duplicate())
    }
  }

  export namespace Notification{
    export function getChannel(receiverId: number) {
      return `s-pub-sub://push/receivers/${receiverId.toString()}/notification` as const
    }
  }
}
