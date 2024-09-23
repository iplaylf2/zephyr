import { Dialogue, Prisma, PrismaClient } from '../../../repositories/prisma/generated/index.js'
import { Inject, Injectable } from '@nestjs/common'
import { Operation, all, call, sleep, spawn, useScope } from 'effection'
import { option, readonlyArray } from 'fp-ts'
import { ConversationService } from '../conversation.service.js'
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

    public *expireDialogue(
      participant: number,
      expireAt: number,
      tx?: Prisma.TransactionClient,
    ): Operation<readonly number[]> {
      if (!tx) {
        const scope = yield * useScope()

        return yield * call(
          this.prismaClient.$transaction(tx =>
            scope.run(() => this.expireDialogue(participant, expireAt, tx)),
          ),
        )
      }

      const dialogues = yield * this.getDialogues(participant, tx)

      const _expireAt = new Date(expireAt)
      const conversations = dialogues.map(x => x.conversation)

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
      const [conversations, dialogues] = yield * all([super.getConversationsRecord(participant), this.getDialogues(participant)])

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

    public *getDialogues(
      participant: number,
       tx: Prisma.TransactionClient = this.prismaClient,
    ): Operation<readonly Dialogue[]> {
      return yield * call(tx.dialogue.findMany({
        where: {
          OR: [
            { initiator: participant },
            { participant },
          ],
          expiredAt: { gt: new Date() },
        },
      }))
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
              expiredAt: conversation.expiredAt,
              initiator,
              participant,
            },
          }))
        }.bind(this))),
      )
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
      const scope = yield * useScope()

      yield * call(
        this.prismaClient.$transaction(tx =>
          scope.run(pipe(
            event.users,
            readonlyArray.map(user =>
              () => this.expireDialogue(user.id, user.expiredAt, tx),
            ),
            cOperation.sequenceArray,
          )),
        ),
      )
    }
  }
}
