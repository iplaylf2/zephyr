import { Conversation, ConversationXParticipant, Prisma, PrismaClient } from '../../generated/prisma/index.js'
import {
  Conversations, ConversationService as EntityConversationService,
} from '../../repositories/redis/entities/conversation.service.js'
import { Operation, all, call, sleep, useScope } from 'effection'
import { flow, pipe } from 'fp-ts/lib/function.js'
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
import defaults from 'defaults'
import { group } from '../../repositories/redis/commands/stream/groups/parallel.js'
import { match } from 'ts-pattern'
import { randomUUID } from 'crypto'
import { readonlyNonEmptyArrayPlus } from '../../kits/fp-ts/readonly-non-empty-array-plus.js'
import { user } from '../../models/user.js'

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
    this.initializeCallbacks.push(() => this.deleteExpiredConversions())
    this.initializeCallbacks.push(() => this.deleteExpiredParticipants())
    this.participantsExpireCallbacks.push(event => this.expireParticipantsByEvent(event))
    this.participantsUnregisterCallbacks.push(event => this.deleteParticipantsByEvent(event))
  }

  public deleteData(participant: number, conversationXKey: Readonly<Record<number, number | string>>) {
    return call(
      this.prismaClient.$transaction(tx => pipe(
        Object.entries(conversationXKey),
        x => Array.from(x),
        readonlyArray.map(
          ([conversation, key]) => pipe(
            () => tx.$executeRaw`
              update
                "conversation-x-participant" x
              set
                data = x.data - ${key}
              from conversations
              where
                conversations.id = x.conversation and
                conversations.type = ${this.type} and
                x.conversation = ${conversation} and
                x.participant = ${participant}`,
            task.map(x => 0 < x ? option.some(Number(conversation)) : option.none),
          ),
        ),
        task.sequenceArray,
        task.map(
          readonlyArray.filterMap(identity.of),
        ),
      )()),
    )
  }

  public *deleteParticipants(conversation: number, participants: readonly number[]) {
    const scope = yield * useScope()

    return yield * call(
      this.prismaClient.$transaction(tx => scope.run(function*(this: ConversationService) {
        const removedParticipants = yield * this.selectParticipantsForUpdate(
          tx, conversation, participants,
        )

        if (0 === removedParticipants.length) {
          return []
        }

        const now = Date.now()

        yield * call(tx.conversationXParticipant.deleteMany({
          where: {
            conversation,
            participant: { in: removedParticipants.concat() },
            xConversation: { type: this.type },
          },
        }))

        yield * this.post(
          conversation,
          system.say({
            content: { participants: removedParticipants, timestamp: now, type: 'leave' },
            type: 'event',
          }),
        )

        return removedParticipants
      }.bind(this))),
    )
  }

  public exists(conversations: readonly number[], tx: Prisma.TransactionClient = this.prismaClient) {
    return pipe(
      () => tx.conversation.findMany({
        select: { id: true },
        where: {
          expiredAt: { gt: new Date() },
          id: { in: conversations.concat() },
          type: this.type,
        },
      }),
      task.map(
        readonlyArray.map(x => x.id),
      ),
      cOperation.FromTask.fromTask,
    )()
  }

  public existsParticipants(conversation: number, participants: readonly number[]) {
    return pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { participant: true },
        where: {
          conversation,
          participant: { in: participants.concat() },
          xConversation: { expiredAt: { gt: new Date() }, type: this.type },
        },
      }),
      task.map(
        readonlyArray.map(x => x.participant),
      ),
      cOperation.FromTask.fromTask,
    )()
  }

  public *expire(
    conversations: readonly number[],
    options?: {
      seconds?: number
      tx?: Prisma.TransactionClient
    },
  ) {
    const { seconds, tx } = defaults(options ?? {}, {
      seconds: this.defaultConversationExpire.total('seconds'),
      tx: this.prismaClient,
    })

    const _conversations = yield * pipe(
      () => tx.conversation.findMany({
        select: { id: true },
        where: {
          expiredAt: { gt: new Date() },
          id: { in: conversations.concat() },
          type: this.type,
        },
      }),
      task.map(
        readonlyArray.map(x => x.id),
      ),
      cOperation.FromTask.fromTask,
    )()

    if (0 === _conversations.length) {
      return []
    }

    const now = Temporal.Now.zonedDateTimeISO()
    const expiredAt = pipe(
      now
        .add({ seconds })
        .epochMilliseconds,
      x => new Date(x),
    )

    yield * pipe(
      _conversations,
      readonlyArray.map(flow(
        x => this.entityConversationService
          .getRecords(this.type, x)
          .key,
        x => () => this.genericService.expireAt(x, expiredAt, 'GT'),
      )),
      cOperation.sequenceArray,
    )()

    yield * call(tx.conversation.updateMany({
      data: { expiredAt },
      where: {
        expiredAt: { lt: expiredAt },
        id: { in: _conversations.concat() },
      },
    }))

    return _conversations
  }

  public *getConversationsRecord(participant: number) {
    const conversations = yield * pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { conversation: true },
        where: {
          participant,
          xConversation: { expiredAt: { gt: new Date() }, type: this.type },
        },
      }),
      task.map(
        readonlyArray.map(x => x.conversation),
      ),
      cOperation.FromTask.fromTask,
    )()

    if (0 === conversations.length) {
      return []
    }

    const records = yield * pipe(
      conversations,
      readonlyArray.map(
        x => () => this.entityConversationService.getRecords(this.type, x).infoStream(),
      ),
      cOperation.sequenceArray,
    )()

    return pipe(
      records,
      readonlyArray.zip(conversations),
      readonlyArray.filterMap(
        ([record, conversation]) => null === record
          ? option.none
          : option.some({
            conversationId: conversation,
            lastMessageId: record.lastEntry?.id ?? null,
          }),
      ),
    )
  }

  public getData(participant: number) {
    return pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { conversation: true, data: true },
        where: {
          participant,
          xConversation: { expiredAt: { gt: new Date() }, type: this.type },
        },
      }),
      task.map(flow(
        readonlyArray.map(x => [x.conversation, x.data as JsonObject] as const),
        x => Object.fromEntries(x),
      )),
      cOperation.FromTask.fromTask,
    )()
  }

  public getParticipants(conversation: number) {
    return pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { participant: true },
        where: {
          conversation,
          xConversation: { expiredAt: { gt: new Date() }, type: this.type },
        },
      }),
      task.map(
        readonlyArray.map(x => x.participant),
      ),
      cOperation.FromTask.fromTask,
    )()
  }

  public patchData(participant: number, conversationXData: Readonly<Record<number, JsonObject>>) {
    return call(
      this.prismaClient.$transaction(tx => pipe(
        Object.entries(conversationXData),
        x => Array.from(x),
        readonlyArray.map(
          ([conversation, data]) => pipe(
            () => tx.$executeRaw`
              update
                "conversation-x-participant" x
              set
                data = x.data || ${data}
                from conversations
              where
                conversations.id = x.conversation and
                conversations.type = ${this.type} and
                x.conversation = ${conversation} and
                x.participant = ${participant}`,
            task.map(x => 0 < x ? option.some(Number(conversation)) : option.none),
          ),
        ),
        task.sequenceArray,
        task.map(
          readonlyArray.filterMap(identity.of),
        ),
      )()),
    )
  }

  public *postConversation(info: conversation.Info) {
    const scope = yield * useScope()

    return yield * call(
      this.prismaClient.$transaction(tx => scope.run(function*(this: ConversationService) {
        const now = Temporal.Now.zonedDateTimeISO()
        const createdAt = new Date(now.epochMilliseconds)
        const expiredAt = new Date(now.add(this.defaultConversationExpire).epochMilliseconds)

        const conversation = yield * pipe(
          () => tx.conversation.create({
            data: {
              createdAt,
              expiredAt,
              name: info.name,
              type: this.type,
            },
          }),
          cOperation.FromTask.fromTask,
        )()

        const records = this.entityConversationService.getRecords(this.type, conversation.id)
        const forCreation = 'for-creation'

        yield * call(this.redisService.multi()
          .xGroupCreate(records.key, forCreation, '$', { MKSTREAM: true })
          .xGroupDestroy(records.key, forCreation)
          .expireAt(records.key, expiredAt)
          .exec(),
        )

        return conversation
      }.bind(this))),
    )
  }

  public *putParticipants(
    conversation: number,
    users: readonly number[],
    tx?: Prisma.TransactionClient,
  ): Operation<readonly number[]> {
    if (!tx) {
      const scope = yield * useScope()

      return yield * call(
        this.prismaClient.$transaction(tx =>
          scope.run(() => this.putParticipants(conversation, users, tx)),
        ),
      )
    }

    const exist = yield * this.exists([conversation], tx)

    if (0 === exist.length) {
      return []
    }

    const _users = yield * this.userService.selectValidUsersForUpdate(tx, users)

    if (0 === _users.length) {
      return []
    }

    const newParticipants = yield * pipe(
      () => tx.conversationXParticipant.findMany({
        select: { participant: true },
        where: {
          conversation,
          participant: { in: _users.concat() },
        },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(flow(
        readonlyArray.map(x => x.participant),
        a => (b: typeof a) => readonlyArray.difference(number.Eq)(b, a),
        identity.ap(_users),
      )),
    )()

    if (0 === newParticipants.length) {
      return []
    }

    const now = Temporal.Now.zonedDateTimeISO()
    const createdAt = new Date(now.epochMilliseconds)
    const expiredAt = new Date(now.add(this.defaultParticipantExpire).epochMilliseconds)

    yield * call(tx.conversationXParticipant.createMany({
      data: newParticipants.map(participant =>
        ({ conversation, createdAt, data: {}, expiredAt, participant }),
      ),
    }))

    yield * this.post(
      conversation,
      system.say({
        content: { participants: newParticipants, timestamp: createdAt.valueOf(), type: 'join' },
        type: 'event',
      }),
    )

    return newParticipants
  }

  public rangeMessages(conversation: number, start: string, end: string) {
    return pipe(
      this.entityConversationService.getRecords(this.type, conversation),
      x => () => x.range(start, end),
      cOperation.map(
        readonlyArray.map(x => ({ id: x.id, ...x.message })),
      ),
    )()
  }

  public selectConversationForUpdate(tx: Prisma.TransactionClient, conversations: readonly number[]) {
    return pipe(
      () => tx.$queryRaw<Pick<Conversation, 'id'>[]>`
        select
          id
        from 
          conversations
        where
          type = ${this.type} and
          id in ${Prisma.join(conversations)}
        for update`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  }

  public selectParticipantsForUpdate(
    tx: Prisma.TransactionClient,
    conversation: number,
    participants: readonly number[],
  ) {
    return pipe(
      () => tx.$queryRaw<Pick<ConversationXParticipant, 'participant'>[]>`
        select
          x.participant 
        from 
          "conversation-x-participant" x
        join conversations on
          conversations.id = x.conversation
        where
          conversations.type = ${this.type} and
          x.conversation = ${conversation}  and
          x.participant in ${Prisma.join(participants)}
        for update`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.participant),
      ),
    )()
  }

  public selectValidConversationForUpdate(tx: Prisma.TransactionClient, conversations: readonly number[]) {
    return pipe(
      () => tx.$queryRaw<Pick<Conversation, 'id'>[]>`
        select
          id
        from 
          conversations
        where 
          type = ${this.type} and
          ${Date.now()} < expiredAt and
          id in ${Prisma.join(conversations)}
        for update`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  }

  public *userPost(conversation: number, participant: number, body: conversation.MessageBody) {
    const exist = yield * this.existsParticipants(conversation, [participant])

    if (0 === exist.length) {
      return null
    }

    const _participant = new Participant(participant, 'user')

    return yield * this.post(conversation, _participant.say(body))
  }

  private *deleteExpiredConversions() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      yield * call(this.prismaClient.conversation.deleteMany({
        where: { expiredAt: { lte: new Date() }, type: this.type },
      }))

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
          select: { conversation: true, participant: true },
          where: {
            expiredAt: { lte: new Date() },
            xConversation: { type: this.type },
          },
        }),
        cOperation.FromTask.fromTask,
        cOperation.map(
          readonlyNonEmptyArrayPlus.groupBy(x => x.conversation),
        ),
      )()

      yield * pipe(
        Array.from(group),
        readonlyArray.map(([conversation, x]) => () =>
          this.deleteParticipants(conversation, x.map(x => x.participant)),
        ),
        cOperation.sequenceArray,
      )()

      yield * sleep(interval)
    }
  }

  private *deleteParticipantsByEvent(event: Extract<user.Event, { type: 'unregister' }>) {
    const deletedUsers = yield * pipe(
      () => this.prismaClient.user.findMany({
        select: { id: true },
        where: { id: { in: event.users.concat() } },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(flow(
        readonlyArray.map(x => x.id),
        a => (b: typeof a) => readonlyArray.difference(number.Eq)(b, a),
        identity.ap(event.users),
      )),
    )()

    if (0 === deletedUsers.length) {
      return
    }

    const group = yield * pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { conversation: true, participant: true },
        where: {
          participant: { in: deletedUsers.concat() },
          xConversation: { type: this.type },
        },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyNonEmptyArrayPlus.groupBy(x => x.conversation),
      ),
    )()

    yield * pipe(
      Array.from(group),
      readonlyArray.map(([conversation, x]) => () =>
        this.deleteParticipants(conversation, x.map(x => x.participant)),
      ),
      cOperation.sequenceArray,
    )()
  }

  private *expireParticipantsByEvent(event: Extract<user.Event, { type: 'expire' }>) {
    const scope = yield * useScope()

    return yield * call(
      this.prismaClient.$transaction(tx => scope.run(function*(this: ConversationService) {
        const expiredAt = pipe(
          Temporal.Instant
            .fromEpochMilliseconds(event.data.timestamp)
            .toZonedDateTimeISO('UTC')
            .add({ seconds: event.data.expire })
            .epochMilliseconds,
          x => new Date(x),
        )

        const toExpire = yield * pipe(
          () => tx.user.findMany({
            select: { id: true },
            where: { expiredAt: { gte: expiredAt }, id: { in: event.users.concat() } },
          }),
          cOperation.FromTask.fromTask,
          cOperation.map(
            readonlyArray.map(x => x.id),
          ),
        )()

        const conversations = yield * pipe(
          () => this.prismaClient.conversationXParticipant.findMany({
            distinct: 'conversation',
            select: { conversation: true },
            where: {
              participant: { in: event.users.concat() },
              xConversation: { expiredAt: { gt: new Date() }, type: this.type },
            },
          }),
          task.map(
            readonlyArray.map(x => x.conversation),
          ),
          cOperation.FromTask.fromTask,
        )()

        yield * all([
          this.expire(conversations, { seconds: event.data.expire, tx }),
          call(tx.conversationXParticipant.updateMany({
            data: { expiredAt },
            where: {
              expiredAt: { lt: expiredAt },
              participant: { in: toExpire.concat() },
              xConversation: { type: this.type },
            },
          })),
        ])
      }.bind(this))),
    )
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

  private post(conversation: number, message: Conversations.Message) {
    return pipe(
      this.entityConversationService.getRecords(this.type, conversation),
      x => x.add(
        '*',
        message,
        { NOMKSTREAM: true, TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } },
      ),
    )
  }
}

const system = new Participant(-1, 'system')
