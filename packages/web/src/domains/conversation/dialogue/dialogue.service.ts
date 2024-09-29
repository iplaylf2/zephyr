import { Inject, Injectable } from '@nestjs/common'
import { Operation, all, call, sleep, spawn } from 'effection'
import { PrismaClient, PrismaTransaction } from '../../../repositories/prisma/client.js'
import { option, readonlyArray } from 'fp-ts'
import { ConversationService } from '../conversation.service.js'
import { Dialogue } from '../../../repositories/prisma/generated/index.js'
import {
  ConversationService as EntityConversationService,
} from '../../../repositories/redis/entities/conversation.service.js'
import { UserService as EntityUserService } from '../../../repositories/redis/entities/user.service.js'
import { GenericService } from '../../../repositories/redis/entities/generic.service.js'
import { RedisService } from '../../../repositories/redis/redis.service.js'
import { Temporal } from 'temporal-polyfill'
import { UserService } from '../../user/user.service.js'
import { cOperation } from '../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { user } from '../../../models/user.js'
import { where } from '../../../repositories/prisma/common/where.js'

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

      this.initializeCallbacks.push(() => this.deleteExpiredDialogues())
      this.participantsExpireCallbacks.push(e => this.expireDialogueByEvent(e))
    }

    public existsDialogues(
      participant: number,
      tx: PrismaTransaction = this.prismaClient,
    ) {
      return this.selectDialoguesForQuery(tx, participant)
    }

    public *expireDialogue(
      participant: number,
      expireAt: number,
      tx?: PrismaTransaction,
    ): Operation<readonly number[]> {
      if (!tx) {
        return yield * this.prismaClient.$callTransaction(tx =>
          () => this.expireDialogue(participant, expireAt, tx),
        )
      }

      const dialogues = yield * this.selectDialoguesForUpdate(tx, participant)

      if (0 === dialogues.length) {
        return []
      }

      const _expireAt = new Date(expireAt)
      const conversations = where.writable(dialogues)

      yield * pipe([
        () => tx.dialogue.updateMany({
          data: { expiredAt: _expireAt },
          where: { conversation: { in: conversations }, expiredAt: { lt: _expireAt } },
        }),
        () => tx.conversation.updateMany({
          data: { expiredAt: _expireAt },
          where: { expiredAt: { lt: _expireAt }, id: { in: conversations } },
        }),
        () => tx.conversationXParticipant.updateMany({
          data: { expiredAt: _expireAt },
          where: {
            conversation: { in: conversations },
            expiredAt: { lt: _expireAt },
            participant,
          },
        }),
      ],
      readonlyArray.map(
        cOperation.FromTask.fromTask,
      ),
      readonlyArray.append<cOperation.COperation<any>>(
        () => this.expireRecords(conversations.map(id => ({ expiredAt: _expireAt, id }))),
      ),
      cOperation.sequenceArray,
      )()

      return conversations
    }

    public override *getConversationsRecord(participant: number) {
      const [conversations, dialogues] = yield * all([
        super.getConversationsRecord(participant),
        call(this.prismaClient.dialogue.findMany({
          select: { conversation: true, initiator: true, participant: true },
          where: {
            OR: [{ initiator: participant }, { participant }],
            expiredAt: { gt: new Date() },
          },
        })),
      ])

      const dialogueMap = Object.fromEntries(dialogues.map(x => [x.conversation, x]))

      return pipe(
        conversations,
        readonlyArray.filterMap(conversation => pipe(
          dialogueMap[conversation.conversationId],
          option.fromNullable,
          option.map(x => ({
            ...conversation,
            initiatorId: x.initiator,
            participantId: x.participant,
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

    public *putDialogue(initiator: number, participant: number) {
      const dialogue = yield * this.getDialogue(initiator, participant)

      if (dialogue) {
        return dialogue
      }

      const conversation = yield * this.postConversation({ name: '' })

      return yield * this.prismaClient.$callTransaction(tx =>
        function*(this: DialogueService) {
          void (yield * spawn(() => this.putParticipants(conversation.id, [initiator, participant], tx)))

          return yield * call(tx.dialogue.create({
            data: {
              conversation: conversation.id,
              expiredAt: conversation.expiredAt,
              initiator,
              participant,
            },
          }))
        }.bind(this),
      )
    }

    public selectDialoguesForQuery(
      tx: PrismaTransaction,
      participant: number,
    ) {
      return pipe(
        () => tx.$queryRaw<Pick<Dialogue, 'conversation'>[]>`
          select
            conversation
          from 
            dialogues
          where
            ${new Date()} < "expiredAt" and
            ( initiator = ${participant} or
              participant = ${participant} )
          for key share`,
        cOperation.FromTask.fromTask,
        cOperation.map(
          readonlyArray.map(x => x.conversation),
        ),
      )()
    }

    public selectDialoguesForUpdate(
      tx: PrismaTransaction,
      participant: number,
    ) {
      return pipe(
        () => tx.$queryRaw<Pick<Dialogue, 'conversation'>[]>`
          select
            conversation
          from 
            dialogues
          where
            ${new Date()} < "expiredAt" and
            ( initiator = ${participant} or
              participant = ${participant} )
          for no key update`,
        cOperation.FromTask.fromTask,
        cOperation.map(
          readonlyArray.map(x => x.conversation),
        ),
      )()
    }

    private *deleteExpiredDialogues() {
      const interval = Temporal.Duration
        .from({ minutes: 10 })
        .total('milliseconds')

      while (true) {
        yield * call(this.prismaClient.dialogue.deleteMany({
          where: { expiredAt: { lte: new Date() } },
        }))

        yield * sleep(interval)
      }
    }

    private *expireDialogueByEvent(event: Extract<user.Event, { type: 'expire' }>) {
      yield * this.prismaClient.$callTransaction(tx => pipe(
        event.users,
        readonlyArray.map(user =>
          () => this.expireDialogue(user.id, user.expiredAt, tx),
        ),
        cOperation.sequenceArray,
      ))
    }
  }
}
