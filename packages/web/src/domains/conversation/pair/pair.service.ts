import { Inject, Injectable } from '@nestjs/common'
import { all, call } from 'effection'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { ConversationService } from '../conversation.service.js'
import { ConversationService as EntityConversationService } from '../../../repositories/redis/entities/conversation.service.js'
import { RedisService } from '../../../repositories/redis/redis.service.js'
import { Temporal } from 'temporal-polyfill'
import { UserService } from '../../../repositories/redis/entities/user.service.js'
import { ioOperation } from '../../../common/fp-effection/io-operation.js'
import { readonlyRecord } from 'fp-ts'
import { user } from '../../../models/user.js'

export namespace conversation{
  @Injectable()
  export class PairService extends ConversationService {
    @Inject()
    protected override entityConversationService!: EntityConversationService

    @Inject()
    protected override entityUserService!: UserService

    @Inject()
    protected override redisService!: RedisService

    public override readonly defaultConversationExpire = Temporal.Duration.from({ days: 1 })
    public override readonly defaultParticipantExpire = Temporal.Duration.from({ days: 1 })
    public override type = 'pair'

    public constructor() {
      super()

      this.participantsExpireCallback.push(event => this.pairExpire(event))
    }

    private pairExpire(event: Extract<user.Event, { type: 'expire' }>) {
      const seconds = event.data.expire

      return all([
        pipe(
          () => this.fetchConversationMap(event.users),
          ioOperation.chain(flow(
            readonlyRecord.keys,
            x => () => this.expire(x),
          )),
        )(),
        pipe(
          this.redisService.multi(),
          t => event.users
            .reduce(
              (t, participant) => t
                .expire(
                  this.entityConversationService.getParticipantConversationsMarked(this.type, participant).key,
                  seconds,
                  'GT',
                )
                .expire(
                  this.entityConversationService.getParticipantConversationsProgress(this.type, participant).key,
                  seconds,
                  'GT',
                ),
              t,
            ),
          t => call(t.exec()),
        ),
      ])
    }
  }
}
