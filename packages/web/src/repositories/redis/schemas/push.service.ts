import { Inject, Injectable } from '@nestjs/common'
import { RedisClientType } from '@redis/client'
import { RedisService } from '../redis.service.js'
import { jsonPubSub } from '../common-schema/json-pub-sub/shard.js'
import { z } from 'zod'

@Injectable()
export class PushService {
  @Inject()
  private readonly redisService!: RedisService

  public getNotification() {
    return new PushService.Notification(this.redisService)
  }
}

export namespace PushService{
  export const pushSchema = z.object({
    source: z.number(),
    type: z.string(),
  })

  export const notificationItemSchema = z.discriminatedUnion('type', [
    z.object({
      pushes: z.array(pushSchema),
      type: z.enum(['subscribe', 'unsubscribe', 'complete']),
    }),
    z.object({ type: z.literal('delete') }),
  ])
  export type NotificationItem = z.infer<typeof notificationItemSchema>

  export class Notification
    extends jsonPubSub.Shard<ReturnType<typeof Notification.getChannel>, NotificationItem> {
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
