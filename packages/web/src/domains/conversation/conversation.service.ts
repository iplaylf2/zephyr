import {
  Conversations, ConversationService as EntityConversationService,
} from '../../repositories/redis/entities/conversation.service.js'
import { Conversation, ConversationXParticipant, Prisma, PrismaClient } from '../../generated/prisma/index.js'
import { Operation, all, call, run, sleep } from 'effection'
import { flip, flow, pipe } from 'fp-ts/lib/function.js'
import { apply, identity, number, option, readonlyArray, readonlyNonEmptyArray, readonlyRecord, semigroup, task } from 'fp-ts'
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
import { GenericService } from '../../repositories/redis/entities/generic.service.js'

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
  protected abstract readonly genericService: GenericService
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

  public deleteData(participant: number, conversationXKey: Readonly<Record<number, number | string>>) {
    return call(
      this.prismaClient.$transaction(tx => pipe(
        Object.entries(conversationXKey),
        x => Array.from(x),
        readonlyArray.map(
          ([conversation, key]) => pipe(
            () => tx.$executeRaw`
            update
              "conversation-x-participant"
            set
              data = data - ${key}
            where
              conversation = ${conversation} and
              participant = ${participant}`,
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

  public deleteParticipants(conversation: number, participants: readonly number[]) {
    return call(
      this.prismaClient.$transaction(tx => run(function*(this: ConversationService) {
        const removedParticipants = yield * this.selectParticipantsForUpdate(tx, conversation, participants)

        if (0 === removedParticipants.length) {
          return []
        }

        yield * call(tx.conversationXParticipant.deleteMany({
          where: { conversation, participant: { in: removedParticipants.concat() } },
        }))

        yield * this.post(
          conversation,
          system.say({
            content: { participants: removedParticipants, type: 'leave' },
            type: 'event',
          }),
        )

        return removedParticipants
      }.bind(this))),
    )
  }

  public exists(conversations: readonly number[]) {
    return pipe(
      () => this.prismaClient.conversation.findMany({
        select: { id: true },
        where: { expiredAt: { gt: new Date() }, id: { in: conversations.concat() } },
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
        where: { conversation, participant: { in: participants.concat() } },
      }),
      task.map(
        readonlyArray.map(x => x.participant),
      ),
      cOperation.FromTask.fromTask,
    )()
  }

  public *expire(
    conversations: readonly number[],
    seconds: number = this.defaultConversationExpire.total('seconds'),
  ) {
    const _conversations = yield * pipe(
      () => this.prismaClient.conversation.findMany({
        where: { expiredAt: { gt: new Date() }, id: { in: conversations.concat() } },
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

    yield * call(this.prismaClient.conversation.updateMany({
      data: { expiredAt },
      where: {
        expiredAt: { lt: expiredAt }, id: { in: _conversations.concat() },
      },
    }))

    return _conversations
  }

  public *getConversationsRecord(participant: number) {
    const conversations = yield * pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { conversation: true },
        where: { participant },
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
        where: { participant },
      }),
      task.map(x =>
        readonlyRecord.fromFoldableMap(
          semigroup.last<JsonObject>(), readonlyArray.Foldable,
        )(
          x, x => [x.conversation.toString(), x.data as JsonObject] as const,
        ),
      ),
      cOperation.FromTask.fromTask,
    )()
  }

  public getParticipants(conversation: number) {
    return pipe(
      () => this.prismaClient.conversationXParticipant.findMany({
        select: { participant: true },
        where: { conversation },
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
              "conversation-x-participant"
            set
              data = data || ${data}
            where
              conversation = ${conversation} and
              participant = ${participant}`,
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

  public rangeMessages(conversation: number, start: string, end: string) {
    return pipe(
      this.entityConversationService.getRecords(this.type, conversation),
      x => () => x.range(start, end),
      cOperation.map(
        readonlyArray.map(x => ({ id: x.id, ...x.message })),
      ),
    )()
  }

  public selectConversationForUpdate(tx: Prisma.TransactionClient, conversation: readonly number[]) {
    return pipe(
      () => tx.$queryRaw<Pick<Conversation, 'id'>[]>`
        select
          id
        from 
          "conversations"
        where
          id in ${conversation}
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
          participant
        from 
          "conversation-x-participant"
        where
          conversation = ${conversation}  and
          participant in ${participants}
        for update`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.participant),
      ),
    )()
  }

  public selectValidConversationForUpdate(tx: Prisma.TransactionClient, conversation: readonly number[]) {
    return pipe(
      () => tx.$queryRaw<Pick<Conversation, 'id'>[]>`
        select
          id
        from 
          "conversations"
        where 
          ${Date.now()} < expiredAt and
          id in ${conversation}
        for update`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
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
      where: { expiredAt: { lt: expiredAt }, participant: { in: toExpire.concat() } },
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
