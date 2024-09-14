import {
  Conversations, ConversationService as EntityConversationService,
} from '../../repositories/redis/entities/conversation.service.js'
import { PrismaClient } from '../../generated/prisma/index.js'
import { Operation, all, call, run, sleep } from 'effection'
import { flip, flow, pipe } from 'fp-ts/lib/function.js'
import { apply, identity, number, option, readonlyArray, readonlyNonEmptyArray, readonlyRecord, task } from 'fp-ts'
import { UserService as EntityUserService } from '../../repositories/redis/entities/user.service.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { Participant } from './participant.js'
import { RedisService } from '../../repositories/redis/redis.service.js'
import { Temporal } from 'temporal-polyfill'
import { cOperation } from '../../common/fp-effection/c-operation.js'
import { conversation } from '../../models/conversation.js'
import { group } from '../../repositories/redis/commands/stream/groups/parallel.js'
import { match } from 'ts-pattern'
import { randomUUID } from 'crypto'
import { user } from '../../models/user.js'
import { UserService } from '../user/user.service.js'
import { readonlyNonEmptyArrayPlus } from '../../kits/fp-ts/readonly-non-empty-array-plus.js'
import { JsonObject, JsonValue } from 'type-fest'

export abstract class ConversationService extends ModuleRaii {
  protected readonly participantsExpireCallbacks
    = new Array<(event: Extract<user.Event, { type: 'expire' }>) => Operation<any>>()

  protected readonly participantsRegisterCallbacks
    = new Array<(event: Extract<user.Event, { type: 'register' }>) => Operation<any>>()

  protected readonly participantsUnregisterCallbacks
    = new Array<(event: Extract<user.Event, { type: 'unregister' }>) => Operation<any>>()

  public abstract readonly defaultConversationExpire: Temporal.Duration
  public abstract readonly defaultParticipantExpire: Temporal.Duration
  public abstract readonly type: string

  protected abstract readonly entityConversationService: EntityConversationService
  protected abstract readonly entityUserService: EntityUserService
  protected abstract readonly prismaClient: PrismaClient
  protected abstract readonly redisService: RedisService
  protected abstract readonly userService: UserService

  public constructor() {
    super()

    this.initializeCallbacks.push(() => this.listenUserEvent())
    this.initializeCallbacks.push(() => this.deleteExpiredParticipants())
    this.participantsExpireCallbacks.push(event => this.expireParticipantsByEvent(event))
    this.participantsUnregisterCallbacks.push(event => this.deleteParticipantsByEvent(event))
  }

  public *addParticipants(conversation: string, users: readonly string[]) {
    const participants = this.entityConversationService.getParticipants(this.type, conversation)
    const expire = this.defaultParticipantExpire.total('seconds')
    const timestamp = Temporal.Now.zonedDateTimeISO()
    const score = timestamp.add(this.defaultParticipantExpire).epochMilliseconds

    const reply = yield * pipe(
      this.redisService.multi(),
      t => users.reduce(
        (t, user) => t
          .zAdd(participants.key, { score, value: user }, { NX: true }),
        t,
      ),
      t => t.expire(participants.key, this.defaultConversationExpire.total('seconds'), 'GT'),
      t => users
        .map(user => this.entityConversationService.getParticipantConversations(this.type, user).key)
        .reduce(
          (t, key) => t
            .sAdd(key, conversation)
            .expire(key, expire, 'GT'),
          t,
        ),
      t => call(t.exec()),
    )

    const newParticipants = pipe(
      reply,
      readonlyArray.takeLeft(users.length),
      readonlyArray.zip(users),
      readonlyArray.filterMap(
        ([reply, user]) => 1 === reply ? option.some(user) : option.none,
      ),
    )

    if (0 === newParticipants.length) {
      return []
    }

    const system = new Participant(-1, 'system')

    yield * this.post(
      conversation,
      system.say({
        content: { participants: newParticipants, timestamp: timestamp.epochMilliseconds, type: 'join' },
        type: 'event',
      }),
    )

    return newParticipants
  }

  public clearProgress(participant: string, conversations: readonly string[]) {
    return pipe(
      this.entityConversationService.getParticipantConversationsProgress(this.type, participant),
      x => x.del(conversations as string[]),
    )
  }

  public *createConversation(id: string): Operation<boolean> {
    const conversation = this.entityConversationService.get(this.type)

    {
      const score = yield * conversation.score(id)

      if (Date.now() < (score ?? 0)) {
        return false
      }
    }

    const records = this.entityConversationService.getRecords(this.type, id)
    const forCreation = 'for-creation'
    const expire = this.defaultConversationExpire.total('seconds')
    const score = Temporal.Now.zonedDateTimeISO().add(this.defaultConversationExpire).epochMilliseconds

    const reply = yield * call(this.redisService.multi()
      .xGroupCreate(records.key, forCreation, '$', { MKSTREAM: true })
      .xGroupDestroy(records.key, forCreation)
      .expire(records.key, expire)
      .zAdd(
        conversation.key,
        {
          score,
          value: id,
        },
      )
      .exec(),
    )

    const ok = pipe(
      reply,
      readonlyArray.last,
      option.fold(
        () => false,
        x => 1 === x,
      ),
    )

    if (!ok) {
      return yield * this.createConversation(id)
    }

    return true
  }

  public *deleteParticipants(conversation: number, participants: readonly number[]) {
    const _participants = this.entityConversationService.getParticipants(this.type, conversation)

    const reply = yield * pipe(
      this.redisService.multi(),
      t => participants.reduce(
        (t, participant) => t
          .zRem(_participants.key, participant),
        t,
      ),
      t => participants.reduce(
        (t, participant) => t
          .sRem(
            this.entityConversationService.getParticipantConversations(this.type, participant).key,
            conversation,
          ),
        t,
      ),
      t => call(t.exec()),
    )

    const removedParticipants = pipe(
      reply,
      readonlyArray.takeLeft(participants.length),
      readonlyArray.zip(participants),
      readonlyArray.filterMap(
        ([reply, participant]) => 1 === reply ? option.some(participant) : option.none,
      ),
    )

    if (0 === removedParticipants.length) {
      return []
    }

    const system = new Participant(-1, 'system')

    yield * this.post(
      conversation,
      system.say({
        content: { participants: removedParticipants, type: 'leave' },
        type: 'event',
      }),
    )

    return removedParticipants
  }

  public *exists(conversations: readonly string[]) {
    const _conversations = this.entityConversationService.get(this.type)

    const reply = yield * _conversations.mScore(conversations)

    return pipe(
      reply,
      readonlyArray.zip(conversations),
      readonlyArray.filterMap(
        ([reply, conversation]) => Date.now() < (reply ?? 0) ? option.some(conversation) : option.none,
      ),
    )
  }

  public *existsParticipants(conversation: string, participants: readonly string[]) {
    const _participants = this.entityConversationService.getParticipants(this.type, conversation)

    const reply = yield * _participants.mScore(participants)

    return pipe(
      reply,
      readonlyArray.zip(participants),
      readonlyArray.filterMap(
        ([reply, participant]) => Date.now() < (reply ?? 0) ? option.some(participant) : option.none,
      ),
    )
  }

  public *expire(conversations: readonly string[], seconds: number = this.defaultConversationExpire.total('seconds')) {
    const _conversations = this.entityConversationService.get(this.type)
    const timestamp = Temporal.Now.zonedDateTimeISO()
    const score = timestamp.add({ seconds }).epochMilliseconds

    const reply = yield * pipe(
      this.redisService.multi()
        .zRemRangeByScore(_conversations.key, 0, timestamp.epochMilliseconds),
      t => conversations.reduce(
        (t, conversation) => t
          .zAdd(_conversations.key, { score, value: conversation }, { CH: true, GT: true, XX: true }),
        t,
      ),
      t => conversations.reduce(
        (t, conversation) => t
          .expire(this.entityConversationService.getParticipants(this.type, conversation).key, seconds, 'GT')
          .expire(this.entityConversationService.getRecords(this.type, conversation).key, seconds, 'GT'),
        t,
      ),
      t => call(t.exec()),
    )

    return pipe(
      reply,
      readonlyArray.dropLeft(1),
      readonlyArray.takeLeft(conversations.length),
      readonlyArray.zip(conversations),
      readonlyArray.filterMap(
        ([reply, conversation]) => 1 === reply ? option.some(conversation) : option.none,
      ),
    )
  }

  public *fetchConversationsRecord(participant: string) {
    const conversations = this.entityConversationService.getParticipantConversations(this.type, participant)

    const _conversations = yield * conversations.members()
    const records = yield * all(
      _conversations.map(
        x => this.entityConversationService.getRecords(this.type, x).infoStream(),
      ),
    )

    return pipe(
      records,
      readonlyArray.zip(_conversations),
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

  public fetchParticipants(conversation: string) {
    return pipe(
      this.entityConversationService.getParticipants(this.type, conversation),
      x => x.range('-inf', '+inf', { BY: 'SCORE' }),
    )
  }

  public getData(participant: string) {
    return pipe(
      this.entityConversationService.getParticipantConversationsProgress(this.type, participant),
      x => () => x.getAll(),
      cOperation.map(
        x => (x ?? {}) as Readonly<Record<string, string>>,
      ),
    )()
  }

  public patchData(participant: number, progress: Readonly<Record<number, JsonObject>>) {
    return call(
      this.prismaClient.$transaction(tx => pipe(
        Object.entries(progress),
        x => Array.from(x),
        flip((now: Date) =>
          readonlyArray.map(flow(
            ([conversation, data]) => [
              () => tx.$executeRaw`
              update
                "conversation-x-participant"
              set
                data = data || ${data}
              where
                conversation = ${conversation} and
                participant = ${participant} and
                ${now} < expiredAt`,
              Number(conversation),
            ] as const,
            ([_task, conversation]) => pipe(
              _task,
              task.map(x => 0 < x ? option.some(conversation) : option.none),
            ),
          ))),
        identity.ap(new Date()),
        task.sequenceArray,
        task.map(
          readonlyArray.filterMap(identity.of),
        ),
      )()),
    )
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

  public *userPost(conversation: number, participant: number, body: conversation.MessageBody) {
    const inConversation = yield * call(this.prismaClient.conversationXParticipant.findFirst({
      select: {},
      where: { conversation, expiredAt: { gt: new Date() }, participant },
    }))

    if (null === inConversation) {
      return null
    }

    const _participant = new Participant(participant, 'user')

    return yield * this.post(conversation, _participant.say(body))
  }

  private *deleteExpiredParticipants() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      const group = yield * pipe(
        () => this.prismaClient.conversationXParticipant.findMany({
          select: { conversation: true, participant: true },
          where: { expiredAt: { lte: new Date() } },
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
        where: { participant: { in: deletedUsers.concat() } },
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
    const expiredAt = pipe(
      Temporal.Instant
        .fromEpochMilliseconds(event.data.timestamp)
        .toZonedDateTimeISO('UTC')
        .add({ seconds: event.data.expire })
        .epochMilliseconds,
      x => new Date(x),
    )

    const toExpire = yield * pipe(
      () => this.prismaClient.user.findMany({
        select: { id: true },
        where: { expiredAt: { gte: expiredAt }, id: { in: event.users.concat() } },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
      ),
    )()

    yield * call(this.prismaClient.conversationXParticipant.updateMany({
      data: { expiredAt },
      where: { expiredAt: { gt: new Date() }, participant: { in: toExpire.concat() } },
    }))
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
          .with({ type: 'register' }, messageHandlerAp(this.participantsRegisterCallbacks))
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
