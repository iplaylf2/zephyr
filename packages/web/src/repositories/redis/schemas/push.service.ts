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
    return new Push.NotificationSchema(this.redisService)
  }
}

export namespace Push{
  export const notification = z.discriminatedUnion('type', [
    z.object({
      pushes: z.array(z.object({
        source: z.number(),
        type: z.string(),
      })),
      type: z.enum(['subscribe', 'unsubscribe', 'complete']),
    }),
    z.object({ type: z.literal('delete') }),
  ])
  export type Notification = z.infer<typeof notification>

  export class NotificationSchema
    extends jsonPubSub.Shard<ReturnType<typeof NotificationSchema.getChannel>, Notification> {
    public constructor(public override client: RedisClientType) {
      super()
    }

    public override decode(x: string) {
      return notification.parse(super.decode(x))
    }

    public getChannel(receiverId: number) {
      return NotificationSchema.getChannel(receiverId)
    }

    protected override duplicate() {
      return new NotificationSchema(this.client.duplicate())
    }
  }

  export namespace NotificationSchema{
    export function getChannel(receiverId: number) {
      return `s-pub-sub://push/receivers/${receiverId.toString()}/notification` as const
    }
  }
}
