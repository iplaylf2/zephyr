import { Inject, Injectable } from '@nestjs/common'
import { JsonHash } from './common/json-hash.js'
import { JsonString } from './common/json-string.js'
import { RedisClientType } from '@redis/client'
import { RedisService } from '../redis.service.js'
import { SortedSet } from '../commands/sorted-set.js'
import { jsonPubSub } from './common/json-pub-sub/shard.js'
import { receiver } from '../../../models/receiver.js'

@Injectable()
export class ReceiverService {
  @Inject()
  private readonly redisService!: RedisService

  public getNotification() {
    return new ReceiverService.Receivers.Notification(this.redisService)
  }

  public getReceiver(id: string) {
    return new ReceiverService.Receiver(this.redisService, id)
  }

  public getSubscriptionReceivers(subject: string) {
    return new ReceiverService.Receiver.SubscriptionReceivers(this.redisService, subject)
  }

  public getSubscriptions(id: string) {
    return new ReceiverService.Receivers.Subscriptions(this.redisService, id)
  }
}

export namespace ReceiverService{
  export class Receiver extends JsonString<receiver.Receiver> {
    public override readonly key

    public constructor(public override client: RedisClientType, id: string) {
      super()

      this.key = `string://receivers/${encodeURIComponent(id)}` as const
    }
  }

  export namespace Receiver{
    export class SubscriptionReceivers extends SortedSet {
      public override readonly key

      public constructor(public override client: RedisClientType, subject: string) {
        super()

        this.key = `sorted-set://receiver/subscriptions/${encodeURIComponent(subject)}/receivers` as const
      }
    }
  }

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

    export class Subscriptions extends JsonHash<receiver.Subscriptions> {
      public override readonly key

      public constructor(public override client: RedisClientType, id: string) {
        super()

        this.key = `hash://receivers/${encodeURIComponent(id)}/subscriptions` as const
      }
    }
  }
}
