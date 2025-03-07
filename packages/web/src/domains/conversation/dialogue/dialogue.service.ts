import { Inject, Injectable } from '@nestjs/common'
import { PrismaClient, PrismaTransaction } from '../../../repositories/prisma/client.js'
import { all, call, sleep, spawn } from 'effection'
import { option, readonlyArray } from 'fp-ts'
import { ConversationService } from '../conversation.service.js'
import { Directive } from '@zephyr/kit/effection/operation.js'
import {
  ConversationService as EntityConversationService,
} from '../../../repositories/redis/entities/conversation.service.js'
import { UserService as EntityUserService } from '../../../repositories/redis/entities/user.service.js'
import { GenericService } from '../../../repositories/redis/entities/generic.service.js'
import { RedisService } from '../../../repositories/redis/redis.service.js'
import { Temporal } from 'temporal-polyfill'
import { UserService } from '../../user/user.service.js'
import { pipe } from 'fp-ts/lib/function.js'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { user } from '../../../models/user.js'
import { where } from '../../../repositories/prisma/common/where.js'

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
    participantId: number,
    tx: PrismaTransaction = this.prismaClient,
  ) {
    return tx.$dialogue().forQuery(participantId)
  }

  public* expireDialogue(
    participantId: number,
    expireAt: number,
    tx?: PrismaTransaction,
  ): Directive<readonly number[]> {
    if (!tx) {
      return yield* this.prismaClient.$callTransaction(
        tx => this.expireDialogue(participantId, expireAt, tx),
      )
    }

    const dialogueIdArray = yield* tx.$dialogue().forUpdate(participantId)

    if (0 === dialogueIdArray.length) {
      return []
    }

    const _expireAt = new Date(expireAt)
    const _dialogueIdArray = where.writable(dialogueIdArray)

    yield* pipe(
      [
        () => tx.dialogue.updateMany({
          data: { expiredAt: _expireAt },
          where: { conversationId: { in: _dialogueIdArray }, expiredAt: { lt: _expireAt } },
        }),
        () => tx.conversation.updateMany({
          data: { expiredAt: _expireAt },
          where: { expiredAt: { lt: _expireAt }, id: { in: _dialogueIdArray } },
        }),
        () => tx.conversationXParticipant.updateMany({
          data: { expiredAt: _expireAt },
          where: {
            conversationId: { in: _dialogueIdArray },
            expiredAt: { lt: _expireAt },
            participantId: participantId,
          },
        }),
      ],
      readonlyArray.map(
        plan.FromTask.fromTask,
      ),
      readonlyArray.append<plan.Plan<any>>(
        () => this.expireRecords(_dialogueIdArray.map(id => ({ expiredAt: _expireAt, id }))),
      ),
      plan.sequenceArray,
    )()

    return _dialogueIdArray
  }

  public override* getConversationsRecord(participantId: number) {
    const [conversations, dialogues] = yield* all([
      super.getConversationsRecord(participantId),
      call(
        () => this.prismaClient.dialogue.findMany({
          select: { conversationId: true, initiatorId: true, participantId: true },
          where: {
            OR: [{ initiatorId: participantId }, { participantId: participantId }],
            expiredAt: { gt: new Date() },
          },
        }),
      ),
    ])

    const dialogueMap = Object.fromEntries(dialogues.map(x => [x.conversationId, x]))

    return pipe(
      conversations,
      readonlyArray.filterMap(
        conversation => pipe(
          dialogueMap[conversation.conversationId],
          option.fromNullable,
          option.map(x =>
            ({
              ...conversation,
              initiatorId: x.initiatorId,
              participantId: x.participantId,
            }),
          ),
        ),
      ),
    )
  }

  public getDialogue(participantIdA: number, participantIdB: number) {
    return pipe(
      () => this.prismaClient.dialogue.findFirst({
        where: {
          OR: [
            { initiatorId: participantIdA, participantId: participantIdB },
            { initiatorId: participantIdB, participantId: participantIdA },
          ],
          expiredAt: { gt: new Date() },
        },
      }),
      plan.FromTask.fromTask,
    )()
  }

  public* putDialogue(initiatorId: number, participantId: number) {
    const dialogue = yield* this.getDialogue(initiatorId, participantId)

    if (dialogue) {
      return dialogue
    }

    const conversation = yield* this.postConversation({ name: '' })

    return yield* this.prismaClient.$callTransaction(
      function* (this: DialogueService, tx: PrismaTransaction) {
        void (yield* spawn(() => this.putParticipants(conversation.id, [initiatorId, participantId], tx)))

        return yield* call(
          () => tx.dialogue.create({
            data: {
              conversationId: conversation.id,
              expiredAt: conversation.expiredAt,
              initiatorId: initiatorId,
              participantId: participantId,
            },
          }),
        )
      }.bind(this),
    )
  }

  private* deleteExpiredDialogues() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      yield* call(
        () => this.prismaClient.dialogue.deleteMany({
          where: { expiredAt: { lte: new Date() } },
        }),
      )

      yield* sleep(interval)
    }
  }

  private* expireDialogueByEvent(event: Extract<user.Event, { type: 'expire' }>) {
    yield* this.prismaClient.$callTransaction(tx =>
      pipe(
        event.users,
        readonlyArray.map(user =>
          () => this.expireDialogue(user.id, user.expiredAt, tx),
        ),
        plan.sequenceArray,
      )(),
    )
  }
}
