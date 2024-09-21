import { Inject, Injectable } from '@nestjs/common'
import { all, call, spawn, useScope } from 'effection'
import { option, readonlyArray } from 'fp-ts'
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

    public override *getConversationsRecord(participant: number) {
      const [conversations, dialogues] = yield * all([super.getConversationsRecord(participant), this.getDialogues(participant)])

      const dialogueMap = Object.fromEntries(dialogues.map(x => [x.conversation, x]))

      return pipe(
        conversations,
        readonlyArray.filterMap(conversation => pipe(
          dialogueMap[conversation.conversationId],
          option.fromNullable,
          option.map(x => ({
            ...conversation,
            initiator: x.initiator,
            participant: x.participant,
          })),
        )),
      )
    }

    public getDialogue(participantA: number, participantB: number) {
      return pipe(
        () => this.prismaClient.dialogue.findFirst({
          where: {
            OR: [
              { initiator: participantA, participant: participantB },
              { initiator: participantB, participant: participantA },
            ],
            expiredAt: { gt: new Date() },
          },
        }),
        cOperation.FromTask.fromTask,
      )()
    }

    public getDialogues(participant: number) {
      return pipe(
        () => this.prismaClient.dialogue.findMany({
          where: {
            OR: [
              { initiator: participant },
              { participant },
            ],
            expiredAt: { gt: new Date() },
          },
        }),
        cOperation.FromTask.fromTask,
      )()
    }

    public *putDialogue(initiator: number, participant: number) {
      const dialogue = yield * this.getDialogue(initiator, participant)

      if (dialogue) {
        return dialogue
      }

      const conversation = yield * this.postConversation({ name: '' })
      const scope = yield * useScope()

      return yield * call(
        this.prismaClient.$transaction(tx => scope.run(function*(this: DialogueService) {
          void (yield * spawn(() => this.putParticipants(conversation.id, [initiator, participant], tx)))

          return yield * call(tx.dialogue.create({
            data: {
              conversation: conversation.id,
              createdAt: conversation.createdAt,
              expiredAt: conversation.expiredAt,
              initiator,
              participant,
            },
          }))
        }.bind(this))),
      )
    }
  }
}
