import { Inject, Injectable } from '@nestjs/common'
import { all, sleep } from 'effection'
import { ConversationService } from '../conversation.service.js'
import { ConversationService as EntityConversationService } from '../../../repositories/redis/entities/conversation.service.js'
import { RedisService } from '../../../repositories/redis/redis.service.js'
import { Temporal } from 'temporal-polyfill'
import { UserService } from '../../../repositories/redis/entities/user.service.js'

export namespace conversation{
  @Injectable()
  export class GroupService extends ConversationService {
    @Inject()
    protected override entityConversationService!: EntityConversationService

    @Inject()
    protected override entityUserService!: UserService

    @Inject()
    protected override redisService!: RedisService

    public override readonly defaultConversationExpire = Temporal.Duration.from({ days: 1 })
    public override readonly defaultParticipantExpire = Temporal.Duration.from({ hours: 1 })
    public override type = 'group'

    public constructor() {
      super()

      this.initializeCallback.push(() => this.createConversation('default'))
      this.initializeCallback.push(() => this.refreshGroup())
    }

    private *refreshGroup() {
      const conversation = this.entityConversationService.get(this.type)
      const interval = Temporal.Duration.from({ minutes: 5 }).total('milliseconds')

      while (true) {
        const validConversations = yield * conversation.range(Date.now(), '+inf', { BY: 'SCORE' })

        yield * all([
          this.expire(validConversations),
          ...validConversations.map(conversation => this.removeExpiredParticipants(conversation)),
        ])

        yield * sleep(interval)
      }
    }
  }
}
