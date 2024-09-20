import { Inject, Injectable } from '@nestjs/common'
import { readonlyArray, task } from 'fp-ts'
import { ConversationService } from '../conversation.service.js'
import { ConversationService as EntityConversationService } from '../../../repositories/redis/entities/conversation.service.js'
import { UserService as EntityUserService } from '../../../repositories/redis/entities/user.service.js'
import { GenericService } from '../../../repositories/redis/entities/generic.service.js'
import { PrismaClient } from '../../../generated/prisma/index.js'
import { RedisService } from '../../../repositories/redis/redis.service.js'
import { Temporal } from 'temporal-polyfill'
import { UserService } from '../../user/user.service.js'
import { cOperation } from '../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { sleep } from 'effection'

export namespace conversation{
  @Injectable()
  export class GroupService extends ConversationService {
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
    public override readonly defaultParticipantExpire = Temporal.Duration.from({ hours: 1 })
    public override readonly type = 'group'

    public constructor() {
      super()

      this.initializeCallbacks.push(() => this.refreshGroup())
    }

    private *refreshGroup() {
      const interval = Temporal.Duration
        .from({ minutes: 10 })
        .total('milliseconds')

      while (true) {
        const conversations = yield * pipe(
          () => this.prismaClient.conversation.findMany({
            select: { id: true },
            where: { expiredAt: { gt: new Date() }, type: this.type },
          }),
          task.map(
            readonlyArray.map(x => x.id),
          ),
          cOperation.FromTask.fromTask,
        )()

        if (0 < conversations.length) {
          yield * this.expire(conversations)
        }

        yield * sleep(interval)
      }
    }
  }
}
