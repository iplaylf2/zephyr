import { Conversation, ConversationXParticipant, Prisma, PrismaClient } from '../../repositories/prisma/generated/index.js'
import {
  Conversations, ConversationService as EntityConversationService,
} from '../../repositories/redis/entities/conversation.service.js'
import { Operation, all, call, sleep, useScope } from 'effection'
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
import { commonWhere } from '../../repositories/prisma/common/common-where.js'
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
    this.initializeCallbacks.push(() => this.expireConversationsEfficiently())
    this.initializeCallbacks.push(() => this.expireParticipantsEfficiently())
    this.initializeCallbacks.push(() => this.deleteExpiredConversions())
    this.initializeCallbacks.push(() => this.deleteExpiredParticipants())
    this.participantsUnregisterCallbacks.push(event => this.deleteParticipantsByEvent(event))
  }

  public *active(conversations: readonly number[], tx?: Prisma.TransactionClient): Operation<readonly number[]> {
    if (!tx) {
      const scope = yield * useScope()

      return yield * call(
        this.prismaClient.$transaction(tx =>
          scope.run(() => this.active(conversations, tx)),
        ),
      )
    }

    const _conversations = yield * this.selectConversationsForUpdate(tx, conversations)

    yield * call(tx.conversation.updateMany({
      data: {
        lastActiveAt: new Date(),
      },
      where: { id: { in: _conversations.concat() } },
    }))

    return _conversations
  }

  public *activeParticipants(
    conversation: number,
    participants: readonly number[],
    tx?: Prisma.TransactionClient,
  ): Operation<readonly number[]> {
    if (!tx) {
      const scope = yield * useScope()

      return yield * call(
        this.prismaClient.$transaction(tx =>
          scope.run(() => this.activeParticipants(conversation, participants, tx)),
        ),
      )
    }

    const _participants = yield * this.selectParticipantsForUpdate(tx, conversation, participants)

    const now = new Date()

    yield * call(tx.conversationXParticipant.updateMany({
      data: {
        lastActiveAt: now,
        updatedAt: now,
      },
      where: { conversation, participant: { in: _participants.concat() } },
    }))

    return _participants
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
              from
                conversations
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
        const _participants = yield * this.selectParticipantsForDelete(tx, conversation, participants)

        if (0 === _participants.length) {
          return []
        }

        const now = Date.now()

        yield * call(tx.conversationXParticipant.deleteMany({
          where: {
            conversation,
            participant: { in: _participants.concat() },
            xConversation: { type: this.type },
          },
        }))

        yield * this.post(
          conversation,
          system.say({
            content: { participants: _participants, timestamp: now, type: 'leave' },
            type: 'event',
          }),
        )

        return _participants
      }.bind(this))),
    )
  }

  public exists(
    conversations: readonly number[],
    tx: Prisma.TransactionClient = this.prismaClient,
  ) {
    return this.selectConversationsForQuery(tx, conversations)
  }

  public existsParticipants(
    conversation: number,
    participants: readonly number[],
    tx: Prisma.TransactionClient = this.prismaClient,
  ) {
    return this.selectParticipantsForQuery(tx, conversation, participants)
  }

  public *expire(
    conversations: readonly number[],
    options?: { seconds?: number, tx?: Prisma.TransactionClient },
  ): Operation<readonly number[]> {
    const { seconds, tx } = defaults(options ?? {}, {
      seconds: this.defaultConversationExpire.total('seconds'),
    })

    if (!tx) {
      const scope = yield * useScope()

      return yield * call(
        this.prismaClient.$transaction(tx =>
          scope.run(() => this.expire(conversations, { seconds, tx })),
        ),
      )
    }

    const interval = `${seconds.toFixed(0)} seconds`
    const now = new Date()

    const _conversations = yield * pipe(
      conversations,
      readonlyArray.map(
        conversation => () => tx.$queryRaw<Pick<Conversation, 'expiredAt' | 'id'> | null>`
          update
            conversations
          set
            "expiredAt" = conversations."lastActiveAt" + ${interval}::interval
          where
            conversations.type = ${this.type} and
            ${now} < conversations."expiredAt" and
            conversations."expiredAt" < conversations."lastActiveAt" + ${interval}::interval and
            conversations.id = ${conversation}
          returning
            conversations."expiredAt", conversations.id`,
      ),
      task.sequenceArray,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.filterMap(option.fromNullable),
      ),
    )()

    yield * this.expireRecords(_conversations)

    return _conversations.map(x => x.id)
  }

  public *expireParticipants(
    conversation: number,
    participants: readonly number[],
    seconds = this.defaultConversationExpire.total('seconds'),
  ) {
    const interval = `${seconds.toFixed(0)} seconds`

    const scope = yield * useScope()

    return yield * call(
      this.prismaClient.$transaction(tx => scope.run(function*(this: ConversationService) {
        return yield * pipe(
          participants,
          flip((now: Date) => readonlyArray.map(
            participant => () => tx.$queryRaw<Pick<ConversationXParticipant, 'participant'> | null>`
              update
                "conversation-x-participant" x
              set
                "expiredAt" = x."lastActiveAt" + ${interval}::interval,
                "updatedAt" = ${now}
              from
                conversations
              where
                conversations.id = x.conversation and
                conversations.type = ${this.type} and
                x."expiredAt" < x."lastActiveAt" + ${interval}::interval and
                x.conversation = ${conversation} and
                x.participant = ${participant}
              returning
                x.participant`,
          )),
          identity.ap(new Date()),
          task.sequenceArray,
          cOperation.FromTask.fromTask,
          cOperation.map(
            readonlyArray.filterMap(flow(
              option.fromNullable,
              option.map(x => x.participant),
            )),
          ),
        )()
      })),
    )
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
        flip((now: Date) => readonlyArray.map(
          ([conversation, data]) => pipe(
            () => tx.$executeRaw`
              update
                "conversation-x-participant" x
              set
                data = x.data || ${data},
                "updatedAt" = ${now}
              from conversations
              where
                conversations.id = x.conversation and
                conversations.type = ${this.type} and
                x.conversation = ${conversation} and
                x.participant = ${participant}`,
            task.map(x => 0 < x ? option.some(Number(conversation)) : option.none),
          ),
        )),
        identity.ap(new Date()),
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
              lastActiveAt: createdAt,
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

    const exists = yield * this.exists([conversation], tx)

    if (0 === exists.length) {
      return []
    }

    const _users = yield * this.userService.exists(users, tx)

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
      data: newParticipants.map(participant => ({
        conversation,
        createdAt,
        data: {},
        expiredAt,
        lastActiveAt: createdAt,
        participant,
        updatedAt: createdAt,
      }),
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

  public selectConversationsForQuery(
    tx: Prisma.TransactionClient,
    conversations: readonly number[],
  ) {
    if (0 === conversations.length) {
      return cOperation.Pointed.of([])()
    }

    return pipe(
      () => tx.$queryRaw<Pick<Conversation, 'id'>[]>`
        select
          id
        from 
          conversations
        where
          type = ${this.type} and
          ${new Date()} < "expiredAt" and
          id in ${Prisma.join(conversations)}
        for key share`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  }

  public selectConversationsForUpdate(
    tx: Prisma.TransactionClient,
    conversations: readonly number[],
  ) {
    if (0 === conversations.length) {
      return cOperation.Pointed.of([])()
    }

    return pipe(
      () => tx.$queryRaw<Pick<Conversation, 'id'>[]>`
        select
          id
        from 
          conversations
        where
          type = ${this.type} and
          ${new Date()} < "expiredAt" and
          id in ${Prisma.join(conversations)}
        for no key update`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  }

  public selectParticipantsForDelete(
    tx: Prisma.TransactionClient,
    conversation: number,
    participants: readonly number[],
  ) {
    if (0 === participants.length) {
      return cOperation.Pointed.of([])()
    }

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
          x.conversation = ${conversation} and
          x.participant in ${Prisma.join(participants)}
        for update`,
      task.map(
        readonlyArray.map(x => x.participant),
      ),
      cOperation.FromTask.fromTask,
    )()
  }

  public selectParticipantsForQuery(
    tx: Prisma.TransactionClient,
    conversation: number,
    participants: readonly number[],
  ) {
    if (0 === participants.length) {
      return cOperation.Pointed.of([])()
    }

    return pipe(
      () => tx.$queryRaw<Pick<ConversationXParticipant, 'participant'>[]>`
        select
          x.participant
        from
          "conversation-x-participant" x
        join conversations on
          conversations.id = x.conversation
        where
          ${new Date()} < conversations."expiredAt" and
          conversations.type = ${this.type} and
          x.conversation = ${conversation} and
          x.participant in ${Prisma.join(participants)}
        for key share`,
      task.map(
        readonlyArray.map(x => x.participant),
      ),
      cOperation.FromTask.fromTask,
    )()
  }

  public selectParticipantsForUpdate(
    tx: Prisma.TransactionClient,
    conversation: number,
    participants: readonly number[],
  ) {
    if (0 === participants.length) {
      return cOperation.Pointed.of([])()
    }

    return pipe(
      () => tx.$queryRaw<Pick<ConversationXParticipant, 'participant'>[]>`
        select
          x.participant
        from
          "conversation-x-participant" x
        join conversations on
          conversations.id = x.conversation
        where
          ${new Date()} < conversations."expiredAt" and
          conversations.type = ${this.type} and
          x.conversation = ${conversation} and
          x.participant in ${Prisma.join(participants)}
        for no key update`,
      task.map(
        readonlyArray.map(x => x.participant),
      ),
      cOperation.FromTask.fromTask,
    )()
  }

  public *userPost(conversation: number, participant: number, body: conversation.MessageBody) {
    const exists = yield * this.existsParticipants(conversation, [participant])

    if (0 === exists.length) {
      return null
    }

    const _participant = new Participant(participant, 'user')

    return yield * this.post(conversation, _participant.say(body))
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
      () => this.userService.selectUsersForKey(this.prismaClient, event.users),
      cOperation.map(flow(
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

  private *expireConversationsEfficiently() {
    const interval = Temporal.Duration
      .from({ minutes: 1 })
      .total('milliseconds')

    while (true) {
      const conversations = yield * pipe(
        () => this.prismaClient.conversation.findMany({
          select: { id: true },
          where: {
            ...commonWhere.halfLife(this.defaultConversationExpire),
            type: this.type,
          },
        }),
        cOperation.FromTask.fromTask,
        cOperation.map(
          readonlyArray.map(x => x.id),
        ),
      )()

      if (0 < conversations.length) {
        yield * this.expire(conversations)
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
          select: { conversation: true, participant: true },
          where: {
            ...commonWhere.halfLife(this.defaultParticipantExpire),
            xConversation: { type: this.type },
          },
        }),
        cOperation.FromTask.fromTask,
        cOperation.map(
          readonlyNonEmptyArrayPlus.groupBy(x => x.conversation),
        ),
      )()

      if (0 < group.size) {
        yield * pipe(
          Array.from(group),
          readonlyArray.map(([conversation, x]) =>
            () => this.expireParticipants(conversation, x.map(x => x.participant)),
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
