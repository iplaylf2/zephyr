import { Inject, Injectable } from '@nestjs/common'
import { ConversationService } from '../conversation.service.js'
import { ConversationService as EntityConversationService } from '../../../repositories/redis/entities/conversation.service.js'
import { UserService as EntityUserService } from '../../../repositories/redis/entities/user.service.js'
import { GenericService } from '../../../repositories/redis/entities/generic.service.js'
import { PrismaClient } from '../../../generated/prisma/index.js'
import { RedisService } from '../../../repositories/redis/redis.service.js'
import { Temporal } from 'temporal-polyfill'
import { UserService } from '../../user/user.service.js'

export namespace conversation{
  @Injectable()
  export class DialogueService extends ConversationService {
    @Inject()
    protected override entityConversationService!: EntityConversationService

    @Inject()
    protected override entityUserService!: EntityUserService

    @Inject()
    protected override genericService!: GenericService

    @Inject()
    protected override prismaClient!: PrismaClient

    @Inject()
    protected override redisService!: RedisService

    @Inject()
    protected override userService!: UserService

    public override readonly defaultConversationExpire = Temporal.Duration.from({ days: 1 })
    public override readonly defaultParticipantExpire = Temporal.Duration.from({ days: 1 })
    public override readonly type = 'dialogue'

    public constructor() {
      super()
    }
  }
}
