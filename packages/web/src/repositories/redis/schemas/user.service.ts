import { Inject, Injectable } from '@nestjs/common'
import { JsonStream } from '../common-schema/json-stream.js'
import { ModuleRaii } from '../../../common/module-raii.js'
import { ReadonlyDeep } from 'type-fest'
import { RedisClientType } from '@redis/client'
import { RedisService } from '../redis.service.js'
import { call } from 'effection'
import { z } from 'zod'

@Injectable()
export class UserService extends ModuleRaii {
  @Inject() private readonly redisService!: RedisService

  public constructor() {
    super()

    this.initializeCallbacks.push(
      function* (this: UserService) {
        const event = this.getEvent()
        const group = 'for-creation'

        yield* call(
          () => this.redisService.multi()
            .xGroupCreate(event.key, group, '$', { MKSTREAM: true })
            .xGroupDestroy(event.key, group)
            .exec(),
        )
      }.bind(this),
    )
  }

  public getEvent() {
    return new User.EventSchema(this.redisService)
  }
}

export namespace User{
  const userId = z.number().int().positive()
  const timestamp = z.number().int().positive()

  export const event = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('expire'),
      users: z.array(
        z.object({
          expiredAt: timestamp,
          id: userId,
        }),
      ),
    }),
    z.object({
      timestamp,
      type: z.literal('register'),
      user: userId,
    }),
    z.object({
      timestamp,
      type: z.literal('unregister'),
      users: z.array(userId),
    }),
  ])
  export type Event = ReadonlyDeep<z.infer<typeof event>>

  export class EventSchema extends JsonStream<Event> {
    public override readonly key = `stream://user/event`

    public constructor(public override client: RedisClientType) {
      super()
    }

    protected override duplicate() {
      return new EventSchema(this.client.duplicate())
    }
  }
}
