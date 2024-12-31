import { Conversation, ConversationXParticipant } from '../../repositories/prisma/generated/index.js'
import {
  Conversations, ConversationService as EntityConversationService,
} from '../../repositories/redis/entities/conversation.service.js'
import { Operation, all, call, sleep } from 'effection'
import { PrismaClient, PrismaTransaction } from '../../repositories/prisma/client.js'
import { flip, flow, pipe } from 'fp-ts/lib/function.js'
import { identity, number, option, readonlyArray, task } from 'fp-ts'
import { UserService as EntityUserService } from '../../repositories/redis/entities/user.service.js'
import { GenericService } from '../../repositories/redis/entities/generic.service.js'
import { JsonObject } from 'type-fest'
import { ModuleRaii } from '../../common/module-raii.js'
import { Participant } from './participant.js'
import { RedisService } from '../../repositories/redis/redis.service.js'
import { Temporal } from 'temporal-polyfill'
import { UserService } from '../user/user.service.js'
import { cOperation } from '../../common/fp-effection/c-operation.js'
import { conversation } from '../../models/conversation.js'
import { group } from '../../repositories/redis/commands/stream/group.js'
import { match } from 'ts-pattern'
import { randomUUID } from 'crypto'
import { readonlyNonEmptyArrayPlus } from '../../kits/fp-ts/readonly-non-empty-array-plus.js'
import { user } from '../../models/user.js'
import { where } from '../../repositories/prisma/common/where.js'

export abstract class ConversationService extends ModuleRaii {
  protected readonly participantsExpireCallbacks
    = new Array<(event: Extract<user.Event, { type: 'expire' }>) => Operation<any>>()

  protected readonly participantsUnregisterCallbacks
    = new Array<(event: Extract<user.Event, { type: 'unregister' }>) => Operation<any>>()

  public abstract readonly defaultConversationExpire: Temporal.Duration
  public abstract readonly defaultParticipantExpire: Temporal.Duration
  public abstract readonly type: string

  protected abstract readonly entityConversationService: EntityConversationService
  protected abstract readonly entityUserService: EntityUserService
  protected abstract readonly genericService: GenericService
  protected abstract readonly prismaClient: PrismaClient
  protected abstract readonly redisService: RedisService
  protected abstract readonly userService: UserService

  public constructor() {
    super()

    this.initializeCallbacks.push(() => this.listenUserEvent())
    this.initializeCallbacks.push(() => this.expireConversationsEfficiently())
    this.initializeCallbacks.push(() => this.expireParticipantsEfficiently())
    this.initializeCallbacks.push(() => this.deleteExpiredConversions())
    this.initializeCallbacks.push(() => this.deleteExpiredParticipants())
    this.participantsUnregisterCallbacks.push(event => this.deleteParticipantsByEvent(event))
  }

  public active(conversationIdArray: readonly number[]) {
    return this.prismaClient.$callTransaction(
      function*(this: ConversationService, tx: PrismaTransaction) {
        const _conversationIdArray = yield * tx.$conversation().forUpdate(this.type, conversationIdArray)

        yield * call(
          () => tx.conversation.updateMany({
            data: {
              lastActiveAt: new Date(),
            },
            where: { id: { in: where.writable(_conversationIdArray) } },
          }),
        )

        return _conversationIdArray
      }.bind(this),
    )
  }

  public activeParticipants(conversationId: number, participantIdArray: readonly number[]) {
    return this.prismaClient.$callTransaction(
      function*(this: ConversationService, tx: PrismaTransaction) {
        const _participantIdArray = yield * tx
          .$conversationXParticipant()
          .participantsForUpdate(this.type, conversationId, participantIdArray)

        yield * call(
          () => tx.conversationXParticipant.updateMany({
            data: {
              lastActiveAt: new Date(),
            },
            where: { conversationId, participantId: { in: where.writable(_participantIdArray) } },
          }),
        )

        return _participantIdArray
      }.bind(this),
    )
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
            cOperation.FromTask.fromTask,
            cOperation.map(x => 0 < x ? Number(conversationId) : null),
          ),
        ),
        cOperation.sequenceArray,
        cOperation.map(
          readonlyArray.filterMap(option.fromNullable),
        ),
      )(),
    )
  }

  public deleteParticipants(conversationId: number, participantIdArray: readonly number[]) {
    return this.prismaClient.$callTransaction(
      function*(this: ConversationService, tx: PrismaTransaction) {
        const _participantIdArray = yield * tx
          .$conversationXParticipant()
          .participantsForScale(this.type, conversationId, participantIdArray)

        if (0 === _participantIdArray.length) {
          return []
        }

        const now = Date.now()

        yield * call(
          () => tx.conversationXParticipant.deleteMany({
            where: {
              conversation: { type: this.type },
              conversationId,
              participantId: { in: where.writable(_participantIdArray) },
            },
          }),
        )

        yield * this.post(
          conversationId,
          system.say({
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
    return this.prismaClient.$callTransaction(
      function*(this: ConversationService, tx: PrismaTransaction) {
        const interval = `${seconds.toFixed(0)} seconds`
        const now = new Date()

        const _conversationIdArray = yield * pipe(
          conversationIdArray,
          readonlyArray.map(
            conversationId => () => tx.$queryRaw<Pick<Conversation, 'expiredAt' | 'id'>[]>`
              update conversations
              set
                "expiredAt" = conversations."lastActiveAt" + ${interval}::interval
              where
                conversations.type = ${this.type} and
                ${now} < conversations."expiredAt" and
                conversations."expiredAt" < conversations."lastActiveAt" + ${interval}::interval and
                conversations.id = ${conversationId}
              returning
                conversations."expiredAt", conversations.id`,
          ),
          task.sequenceArray,
          cOperation.FromTask.fromTask,
          cOperation.map(
            readonlyArray.filterMap(readonlyArray.head),
          ),
        )()

        yield * this.expireRecords(_conversationIdArray)

        return _conversationIdArray.map(x => x.id)
      }.bind(this),
    )
  }

  public expireParticipants(
    conversationId: number,
    participantIdArray: readonly number[],
    seconds = this.defaultConversationExpire.total('seconds'),
  ) {
    const interval = `${seconds.toFixed(0)} seconds`

    return this.prismaClient.$callTransaction(
      function*(this: ConversationService, tx: PrismaTransaction) {
        return yield * pipe(
          participantIdArray,
          readonlyArray.map(
            participantId => () => tx.$queryRaw<Pick<ConversationXParticipant, 'participantId'>[]>`
              update "conversation-x-participant" x
              set
                "expiredAt" = x."lastActiveAt" + ${interval}::interval
              from
                conversations
              where
                conversations.id = x."conversationId" and
                conversations.type = ${this.type} and
                x."expiredAt" < x."lastActiveAt" + ${interval}::interval and
                x."conversationId" = ${conversationId} and
                x."participantId" = ${participantId}
              returning
                x."participantId"`,
          ),
          task.sequenceArray,
          cOperation.FromTask.fromTask,
          cOperation.map(
            readonlyArray.filterMap(flow(
              readonlyArray.head,
              option.map(x => x.participantId),
            )),
          ),
        )()
      }.bind(this),
    )
  }

  public *getConversationsRecord(participantId: number) {
    const conversationIdArray = yield * pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { conversationId: true },
        where: {
          conversation: { expiredAt: { gt: new Date() }, type: this.type },
          participantId,
        },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.conversationId),
      ),
    )()

    if (0 === conversationIdArray.length) {
      return []
    }

    const records = yield * pipe(
      conversationIdArray,
      readonlyArray.map(
        x => () => this.entityConversationService.getRecords(this.type, x).infoStream(),
      ),
      cOperation.sequenceArray,
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

  public getData(participantId: number) {
    return pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { conversationId: true, data: true },
        where: {
          conversation: { expiredAt: { gt: new Date() }, type: this.type },
          participantId,
        },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(flow(
        readonlyArray.map(x => [x.conversationId, x.data as JsonObject] as const),
        x => Object.fromEntries(x),
      )),
    )()
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
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.participantId),
      ),
    )()
  }

  public patchData(participantId: number, conversationXData: Readonly<Record<number, JsonObject>>) {
    return this.prismaClient.$callTransaction(tx =>
      pipe(
        Object.entries(conversationXData),
        x => Array.from(x),
        flip((now: Date) => readonlyArray.map(
          ([conversationId, data]) => pipe(
            () => tx.$executeRaw`
            update "conversation-x-participant" x
            set
              data = x.data || ${data},
              "lastActiveAt" = ${now}
            from conversations
            where
              conversations.id = x."conversationId" and
              conversations.type = ${this.type} and
              x."conversationId" = ${conversationId} and
              x."participantId" = ${participantId}`,
            cOperation.FromTask.fromTask,
            cOperation.map(x => 0 < x ? Number(conversationId) : null),
          ),
        )),
        identity.ap(new Date()),
        cOperation.sequenceArray,
        cOperation.map(
          readonlyArray.filterMap(option.fromNullable),
        ),
      )(),
    )
  }

  public postConversation(info: conversation.Info) {
    return this.prismaClient.$callTransaction(
      function*(this: ConversationService, tx: PrismaTransaction) {
        const now = Temporal.Now.zonedDateTimeISO()
        const createdAt = new Date(now.epochMilliseconds)
        const expiredAt = new Date(now.add(this.defaultConversationExpire).epochMilliseconds)

        const conversation = yield * pipe(
          () => tx.conversation.create({
            data: {
              createdAt,
              expiredAt,
              lastActiveAt: createdAt,
              name: info.name,
              type: this.type,
            },
          }),
          cOperation.FromTask.fromTask,
        )()

        const records = this.entityConversationService.getRecords(this.type, conversation.id)
        const forCreation = 'for-creation'

        yield * call(
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

  public *putParticipants(
    conversationId: number,
    userIdArray: readonly number[],
    tx?: PrismaTransaction,
  ): Operation<readonly number[]> {
    if (!tx) {
      return yield * this.prismaClient.$callTransaction(
        tx => this.putParticipants(conversationId, userIdArray, tx),
      )
    }

    const exists = yield * this.exists([conversationId], tx)

    if (0 === exists.length) {
      return []
    }

    const _userIdArray = yield * this.userService.exists(userIdArray, tx)

    if (0 === _userIdArray.length) {
      return []
    }

    const newParticipantIdArray = yield * pipe(
      () => tx.$conversationXParticipant().participantsForScale(this.type, conversationId, _userIdArray),
      cOperation.map(flow(
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

    yield * call(
      () => tx.conversationXParticipant.createMany({
        data: newParticipantIdArray.map(participantId =>
          ({
            conversationId,
            createdAt,
            data: {},
            expiredAt,
            lastActiveAt: createdAt,
            participantId,
          }),
        ),
      }))

    yield * this.post(
      conversationId,
      system.say({
        content: { participantIdArray: newParticipantIdArray, timestamp: createdAt.valueOf(), type: 'join' },
        type: 'event',
      }),
    )

    return newParticipantIdArray
  }

  public rangeMessages(conversationId: number, start: string, end: string) {
    return pipe(
      this.entityConversationService.getRecords(this.type, conversationId),
      x => () => x.range(start, end),
      cOperation.map(
        readonlyArray.map(x => ({ id: x.id, ...x.message })),
      ),
    )()
  }

  public *userPost(conversationId: number, participantId: number, body: conversation.MessageBody) {
    const exists = yield * this.existsParticipants(conversationId, [participantId])

    if (0 === exists.length) {
      return null
    }

    const _participant = new Participant(participantId, 'user')

    return yield * this.post(conversationId, _participant.say(body))
  }

  protected expireRecords(conversations: readonly Pick<Conversation, 'expiredAt' | 'id'>[]) {
    return pipe(
      conversations,
      readonlyArray.map(({ id, expiredAt }) => pipe(
        this.entityConversationService
          .getRecords(this.type, id)
          .key,
        key => () => this.genericService.expireAt(key, expiredAt, 'GT'),
      )),
      cOperation.sequenceArray,
    )()
  }

  private *deleteExpiredConversions() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      yield * call(
        () => this.prismaClient.conversation.deleteMany({
          where: { expiredAt: { lte: new Date() }, type: this.type },
        }),
      )

      yield * sleep(interval)
    }
  }

  private *deleteExpiredParticipants() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      const group = yield * pipe(
        () => this.prismaClient.conversationXParticipant.findMany({
          select: { conversationId: true, participantId: true },
          where: {
            conversation: { type: this.type },
            expiredAt: { lte: new Date() },
          },
        }),
        cOperation.FromTask.fromTask,
        cOperation.map(
          readonlyNonEmptyArrayPlus.groupBy(x => x.conversationId),
        ),
      )()

      yield * pipe(
        Array.from(group),
        readonlyArray.map(([conversationId, x]) =>
          () => this.deleteParticipants(conversationId, x.map(x => x.participantId)),
        ),
        cOperation.sequenceArray,
      )()

      yield * sleep(interval)
    }
  }

  private *deleteParticipantsByEvent(event: Extract<user.Event, { type: 'unregister' }>) {
    const deletedUserIdArray = yield * pipe(
      () => this.prismaClient.$user().forKey(event.users),
      cOperation.map(flow(
        a => (b: typeof a) => readonlyArray.difference(number.Eq)(b, a),
        identity.ap(event.users),
      )),
    )()

    if (0 === deletedUserIdArray.length) {
      return
    }

    const group = yield * pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { conversationId: true, participantId: true },
        where: {
          conversation: { type: this.type },
          participantId: { in: where.writable(deletedUserIdArray) },
        },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyNonEmptyArrayPlus.groupBy(x => x.conversationId),
      ),
    )()

    yield * pipe(
      Array.from(group),
      readonlyArray.map(
        ([conversationId, x]) => () => this.deleteParticipants(conversationId, x.map(x => x.participantId)),
      ),
      cOperation.sequenceArray,
    )()
  }

  private *expireConversationsEfficiently() {
    const interval = Temporal.Duration
      .from({ minutes: 1 })
      .total('milliseconds')

    while (true) {
      const conversationIdArray = yield * pipe(
        () => this.prismaClient.conversation.findMany({
          select: { id: true },
          where: {
            ...where.halfLife(this.defaultConversationExpire),
            type: this.type,
          },
        }),
        cOperation.FromTask.fromTask,
        cOperation.map(
          readonlyArray.map(x => x.id),
        ),
      )()

      if (0 < conversationIdArray.length) {
        yield * this.expire(conversationIdArray)
      }

      yield * sleep(interval)
    }
  }

  private *expireParticipantsEfficiently() {
    const interval = Temporal.Duration
      .from({ minutes: 1 })
      .total('milliseconds')

    while (true) {
      const group = yield * pipe(
        () => this.prismaClient.conversationXParticipant.findMany({
          select: { conversationId: true, participantId: true },
          where: {
            ...where.halfLife(this.defaultParticipantExpire),
            conversation: { type: this.type },
          },
        }),
        cOperation.FromTask.fromTask,
        cOperation.map(
          readonlyNonEmptyArrayPlus.groupBy(x => x.conversationId),
        ),
      )()

      if (0 < group.size) {
        yield * pipe(
          Array.from(group),
          readonlyArray.map(([conversationId, x]) =>
            () => this.expireParticipants(conversationId, x.map(x => x.participantId)),
          ),
          cOperation.sequenceArray,
        )()
      }

      yield * sleep(interval)
    }
  }

  private *listenUserEvent() {
    const event = this.entityUserService.getEvent()
    const parallelGroup = new group.Parallel(event, `${this.type}.conversation`)

    const messageHandlerAp = <A, B>(callbacks: Array<(a: A) => B>) => flow(
      identity.ap<A>,
      readonlyArray.map<(a: A) => B, B>,
      identity.ap(callbacks),
    )

    yield * parallelGroup.read(
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

  private post(conversationId: number, message: Conversations.Message) {
    return pipe(
      this.entityConversationService.getRecords(this.type, conversationId),
      x => x.add(
        '*',
        message,
        { NOMKSTREAM: true, TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } },
      ),
    )
  }
}

const system = new Participant(-1, 'system')
