import { Conversation, ConversationXParticipant } from '../../repositories/prisma/generated/index.js'
import { PrismaClient, PrismaTransaction } from '../../repositories/prisma/client.js'
import { all, call, sleep } from 'effection'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { identity, number, option, readonlyArray, task } from 'fp-ts'
import { ConversationInfo } from './entities/conversation-info.js'
import { Directive } from '@zephyr/kit/effection/operation.js'
import { GenericService } from '../../repositories/redis/schemas/generic.service.js'
import { Message } from './entities/message.js'
import { MessageBody } from './value-object.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { Participant } from './aggregates/participant.js'
import {
  ConversationService as RedisConversationService,
} from '../../repositories/redis/schemas/conversation.service.js'
import { RedisService } from '../../repositories/redis/redis.service.js'
import { UserService as RedisUserService } from '../../repositories/redis/schemas/user.service.js'
import { Temporal } from 'temporal-polyfill'
import { UserEvent } from '../user/entities/user-event.js'
import { UserService } from '../user/user.service.js'
import { group } from '../../repositories/redis/commands/stream/group.js'
import { match } from 'ts-pattern'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { randomUUID } from 'crypto'
import { readonlyNonEmptyArrayPlus } from '@zephyr/kit/fp-ts/readonly-non-empty-array-plus.js'
import { where } from '../../repositories/prisma/common/where.js'

export abstract class ConversationService extends ModuleRaii {
  protected readonly participantsExpireCallbacks
    = new Array<(event: Extract<UserEvent, { type: 'expire' }>) => Directive<any>>()

  protected readonly participantsUnregisterCallbacks
    = new Array<(event: Extract<UserEvent, { type: 'unregister' }>) => Directive<any>>()

  public abstract readonly defaultConversationExpire: Temporal.Duration
  public abstract readonly defaultParticipantExpire: Temporal.Duration
  public abstract readonly type: string

  protected abstract readonly genericService: GenericService
  protected abstract readonly prismaClient: PrismaClient
  protected abstract readonly redisConversationService: RedisConversationService
  protected abstract readonly redisService: RedisService
  protected abstract readonly redisUserService: RedisUserService
  protected abstract readonly userService: UserService

  public constructor() {
    super()

    this.initializePlans.push(() => this.listenUserEvent())
    this.initializePlans.push(() => this.deleteExpiredConversions())
    this.initializePlans.push(() => this.deleteExpiredParticipants())
    this.participantsUnregisterCallbacks.push(event => this.deleteParticipantsByEvent(event))
  }

  public active(conversationIdArray: readonly number[]) {
  }

  public activeParticipants(conversationId: number, participantIdArray: readonly number[]) {
  }

  public deleteData(participantId: number, conversationXKey: Readonly<Record<number, number | string>>) {
    return this.prismaClient.$callTransaction(tx =>
      pipe(
        Object.entries(conversationXKey),
        x => Array.from(x),
        readonlyArray.map(
          ([conversationId, key]) => pipe(
            () => tx.$executeRaw`
              update "conversation-x-participant" x
              set
                data = x.data - ${key}
              from
                conversations
              where
                conversations.id = x."conversationId" and
                conversations.type = ${this.type} and
                x."conversationId" = ${conversationId} and
                x."participantId" = ${participantId}`,
            plan.FromTask.fromTask,
            plan.map(x => 0 < x ? Number(conversationId) : null),
          ),
        ),
        plan.sequenceArray,
        plan.map(
          readonlyArray.filterMap(option.fromNullable),
        ),
      )(),
    )
  }

  public deleteParticipants(conversationId: number, participantIdArray: readonly number[]) {
    return this.prismaClient.$callTransaction(
      function* (this: ConversationService, tx: PrismaTransaction) {
        const _participantIdArray = yield* tx
          .$conversationXParticipant()
          .participantsForScale(this.type, conversationId, participantIdArray)

        if (0 === _participantIdArray.length) {
          return []
        }

        const now = Date.now()

        yield* call(
          () => tx.conversationXParticipant.deleteMany({
            where: {
              conversation: { type: this.type },
              conversationId,
              participantId: { in: where.writable(_participantIdArray) },
            },
          }),
        )

        yield* this.post(
          conversationId,
          Participant.system.say({
            content: { participantId: _participantIdArray, timestamp: now, type: 'leave' },
            type: 'event',
          }),
        )

        return _participantIdArray
      }.bind(this),
    )
  }

  public exists(
    conversationIdArray: readonly number[],
    tx: PrismaTransaction = this.prismaClient,
  ) {
    return tx.$conversation().forQuery(this.type, conversationIdArray)
  }

  public existsParticipants(
    conversationId: number,
    participantIdArray: readonly number[],
    tx: PrismaTransaction = this.prismaClient,
  ) {
    return tx.$conversationXParticipant().participantsForQuery(this.type, conversationId, participantIdArray)
  }

  public expire(
    conversationIdArray: readonly number[],
    seconds = this.defaultConversationExpire.total('seconds'),
  ) {

  }

  public expireParticipants(
    conversationId: number,
    participantIdArray: readonly number[],
    seconds = this.defaultConversationExpire.total('seconds'),
  ) {
  }

  public* getConversationsRecord(participantId: number) {
    const conversationIdArray = yield* pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { conversationId: true },
        where: {
          conversation: { expiredAt: { gt: new Date() }, type: this.type },
          participantId,
        },
      }),
      plan.FromTask.fromTask,
      plan.map(
        readonlyArray.map(x => x.conversationId),
      ),
    )()

    if (0 === conversationIdArray.length) {
      return []
    }

    const records = yield* pipe(
      conversationIdArray,
      readonlyArray.map(
        x => () => this.redisConversationService.getRecords(this.type, x).infoStream(),
      ),
      plan.sequenceArray,
    )()

    return pipe(
      records,
      readonlyArray.zip(conversationIdArray),
      readonlyArray.filterMap(
        ([record, conversationId]) => null === record
          ? option.none
          : option.some({
              conversationId,
              lastMessageId: record.lastEntry?.id ?? null,
            }),
      ),
    )
  }

  public getParticipants(conversationId: number) {
    return pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { participantId: true },
        where: {
          conversation: { expiredAt: { gt: new Date() }, type: this.type },
          conversationId,
        },
      }),
      plan.FromTask.fromTask,
      plan.map(
        readonlyArray.map(x => x.participantId),
      ),
    )()
  }

  public getVault(conversationId: number, participantId: number) {
    const vault = this.redisConversationService.getVault(this.type, conversationId, participantId)

    return vault.get()
  }

  public postConversation(info: Omit<ConversationInfo, 'id'>) {
    return this.prismaClient.$callTransaction(
      function* (this: ConversationService, tx: PrismaTransaction) {
        const now = Temporal.Now.zonedDateTimeISO()
        const createdAt = new Date(now.epochMilliseconds)
        const expiredAt = new Date(now.add(this.defaultConversationExpire).epochMilliseconds)

        const records = this.redisConversationService.getRecords(this.type, conversation.id)
        const forCreation = 'for-creation'

        yield* call(
          () => this.redisService.multi()
            .xGroupCreate(records.key, forCreation, '$', { MKSTREAM: true })
            .xGroupDestroy(records.key, forCreation)
            .expireAt(records.key, expiredAt)
            .exec(),
        )

        return conversation
      }.bind(this),
    )
  }

  public* putParticipants(
    conversationId: number,
    userIdArray: readonly number[],
    tx?: PrismaTransaction,
  ): Directive<readonly number[]> {
    if (!tx) {
      return yield* this.prismaClient.$callTransaction(
        tx => this.putParticipants(conversationId, userIdArray, tx),
      )
    }

    const exists = yield* this.exists([conversationId], tx)

    if (0 === exists.length) {
      return []
    }

    const _userIdArray = yield* this.userService.exists(userIdArray, tx)

    if (0 === _userIdArray.length) {
      return []
    }

    const newParticipantIdArray = yield* pipe(
      () => tx.$conversationXParticipant().participantsForScale(this.type, conversationId, _userIdArray),
      plan.map(flow(
        a => (b: typeof a) => readonlyArray.difference(number.Eq)(b, a),
        identity.ap(_userIdArray),
      )),
    )()

    if (0 === newParticipantIdArray.length) {
      return []
    }

    const now = Temporal.Now.zonedDateTimeISO()
    const createdAt = new Date(now.epochMilliseconds)
    const expiredAt = new Date(now.add(this.defaultParticipantExpire).epochMilliseconds)

    yield* this.post(
      conversationId,
      Participant.system.say({
        content: { participantIdArray: newParticipantIdArray, timestamp: createdAt.valueOf(), type: 'join' },
        type: 'event',
      }),
    )

    return newParticipantIdArray
  }

  public* putVault(conversationId: number, participantId: number, value: string) {
    const vault = this.redisConversationService.getVault(this.type, conversationId, participantId)
    yield* vault.set(value)
  }

  public rangeMessages(conversationId: number, start: string, end: string) {
    return pipe(
      this.redisConversationService.getRecords(this.type, conversationId),
      x => () => x.range(start, end),
      plan.map(
        readonlyArray.map(x => ({ id: x.id, ...x.message })),
      ),
    )()
  }

  public* userPost(conversationId: number, participantId: number, body: MessageBody) {
    const exists = yield* this.existsParticipants(conversationId, [participantId])

    if (0 === exists.length) {
      return null
    }

    const _participant = new Participant(participantId, 'user')

    return yield* this.post(conversationId, _participant.say(body))
  }

  protected expireRecords(conversations: readonly Pick<Conversation, 'expiredAt' | 'id'>[]) {
    return pipe(
      conversations,
      readonlyArray.map(({ id, expiredAt }) => pipe(
        this.redisConversationService
          .getRecords(this.type, id)
          .key,
        key => () => this.genericService.expireAt(key, expiredAt, 'GT'),
      )),
      plan.sequenceArray,
    )()
  }

  // protected expireVaults(conversationId: number, participantId: number, expiredAt: number) {
  //   // todo
  // }

  private* deleteExpiredConversions() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      yield* call(
        () => this.prismaClient.conversation.deleteMany({
          where: { expiredAt: { lte: new Date() }, type: this.type },
        }),
      )

      yield* sleep(interval)
    }
  }

  private* deleteExpiredParticipants() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      const group = yield* pipe(
        () => this.prismaClient.conversationXParticipant.findMany({
          select: { conversationId: true, participantId: true },
          where: {
            conversation: { type: this.type },
            expiredAt: { lte: new Date() },
          },
        }),
        plan.FromTask.fromTask,
        plan.map(
          readonlyNonEmptyArrayPlus.groupBy(x => x.conversationId),
        ),
      )()

      yield* pipe(
        Array.from(group),
        readonlyArray.map(([conversationId, x]) =>
          () => this.deleteParticipants(conversationId, x.map(x => x.participantId)),
        ),
        plan.sequenceArray,
      )()

      yield* sleep(interval)
    }
  }

  private* deleteParticipantsByEvent(event: Extract<UserEvent, { type: 'unregister' }>) {
    const deletedUserIdArray = yield* pipe(
      () => this.prismaClient.$user().forKey(event.users),
      plan.map(flow(
        a => (b: typeof a) => readonlyArray.difference(number.Eq)(b, a),
        identity.ap(event.users),
      )),
    )()

    if (0 === deletedUserIdArray.length) {
      return
    }

    const group = yield* pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { conversationId: true, participantId: true },
        where: {
          conversation: { type: this.type },
          participantId: { in: where.writable(deletedUserIdArray) },
        },
      }),
      plan.FromTask.fromTask,
      plan.map(
        readonlyNonEmptyArrayPlus.groupBy(x => x.conversationId),
      ),
    )()

    yield* pipe(
      Array.from(group),
      readonlyArray.map(([conversationId, x]) =>
        () => this.deleteParticipants(conversationId, x.map(x => x.participantId)),
      ),
      plan.sequenceArray,
    )()
  }

  private* listenUserEvent() {
    const event = this.redisUserService.getEvent()
    const parallelGroup = new group.Parallel(event, `${this.type}.conversation`)

    const messageHandlerAp = <A, B>(callbacks: Array<(a: A) => B>) => flow(
      identity.ap<A>,
      readonlyArray.map<(a: A) => B, B>,
      identity.ap(callbacks),
    )

    try {
      yield* event.groupCreate(parallelGroup.group, '0')
    }
    catch {
      // ignore duplicated group
    }

    yield* parallelGroup.read(
      randomUUID(),
      flow(
        ({ message }) => match(message)
          .with({ type: 'expire' }, messageHandlerAp(this.participantsExpireCallbacks))
          .with({ type: 'register' }, () => [])
          .with({ type: 'unregister' }, messageHandlerAp(this.participantsUnregisterCallbacks))
          .exhaustive(),
        all,
      ),
    )
  }

  private post(conversationId: number, message: Omit<Message, 'id'>) {
    return pipe(
      this.redisConversationService.getRecords(this.type, conversationId),
      x => x.add(
        '*',
        message,
        { NOMKSTREAM: true, TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } },
      ),
    )
  }
}
