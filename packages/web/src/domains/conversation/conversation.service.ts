import { Conversations, ConversationService as EntityConversationService } from '../../repositories/redis/entities/conversation.service.js'
import { Operation, all, call } from 'effection'
import { identity, option, readonlyArray, readonlyNonEmptyArray, readonlyRecord } from 'fp-ts'
import { UserService as EntityUserService } from '../../repositories/redis/entities/user.service.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { Participant } from './participant.js'
import { RedisService } from '../../repositories/redis/redis.service.js'
import { Temporal } from 'temporal-polyfill'
import { conversation } from '../../models/conversation.js'
import { group } from '../../repositories/redis/commands/stream/groups/parallel.js'
import { match } from 'ts-pattern'
import { pipe } from 'fp-ts/lib/function.js'
import { randomUUID } from 'crypto'
import { user } from '../../models/user.js'

export abstract class ConversationService extends ModuleRaii {
  protected readonly participantsExpireCallbacks = new Array<(event: Extract<user.Event, { type: 'expire' }>) => Operation<any>>()
  protected readonly participantsRegisterCallbacks = new Array<(event: Extract<user.Event, { type: 'register' }>) => Operation<any>>()
  protected readonly participantsUnregisterCallbacks = new Array<(event: Extract<user.Event, { type: 'unregister' }>) => Operation<any>>()

  public abstract readonly defaultConversationExpire: Temporal.Duration
  public abstract readonly defaultParticipantExpire: Temporal.Duration
  public abstract readonly type: string

  protected abstract readonly entityConversationService: EntityConversationService
  protected abstract readonly entityUserService: EntityUserService
  protected abstract readonly redisService: RedisService

  public constructor() {
    super()

    this.initializeCallbacks.push(() => this.listenUserEvent())
    this.participantsExpireCallbacks.push(event => this.expireParticipantsByEvent(event))
    this.participantsUnregisterCallbacks.push(event => this.removeParticipantsByEvent(event))
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

    const system = new Participant('0', 'system')

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
      option.match(
        () => false,
        x => 1 === x,
      ),
    )

    if (!ok) {
      return yield * this.createConversation(id)
    }

    return true
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
    const participants = this.entityConversationService.getParticipants(this.type, conversation)

    return participants.range('-inf', '+inf', { BY: 'SCORE' })
  }

  public *rangeMessages(conversation: string, start: string, end: string) {
    const records = this.entityConversationService.getRecords(this.type, conversation)

    const messages = yield * records.range(start, end)

    return messages.map(x => ({ id: x.id, ...x.message }))
  }

  public *removeParticipants(conversation: string, participants: readonly string[]) {
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

    const system = new Participant('0', 'system')

    yield * this.post(
      conversation,
      system.say({
        content: { participants: removedParticipants, type: 'leave' },
        type: 'event',
      }),
    )

    return removedParticipants
  }

  public *userPost(conversation: string, participant: string, body: conversation.MessageBody) {
    const added = yield * this.addParticipants(conversation, [participant])

    if (0 === added.length) {
      return null
    }

    const _participant = new Participant(participant, 'user')

    return yield * this.post(conversation, _participant.say(body))
  }

  protected *fetchConversationMap(participants: readonly string[]) {
    const allConversations = yield * all(
      participants.map(x =>
        this.entityConversationService.getParticipantConversations(this.type, x)
          .members(),
      ),
    )

    return pipe(
      readonlyArray.zip(allConversations, participants),
      readonlyArray.chain(
        ([conversations, participant]) => conversations.map(conversation => ({ conversation, participant })),
      ),
      readonlyNonEmptyArray.groupBy(x => x.conversation),
      readonlyRecord.map(x => x.map(x => x.participant)),
    )
  }

  protected *removeExpiredParticipants(conversation: string) {
    const participants = this.entityConversationService.getParticipants(this.type, conversation)

    const _participants = yield * participants.range(0, Date.now(), { BY: 'SCORE' })

    return yield * this.removeParticipants(conversation, _participants)
  }

  private *expireParticipants(conversation: string, participants: readonly string[], seconds: number) {
    const _participants = this.entityConversationService.getParticipants(this.type, conversation)
    const score = Temporal.Now.zonedDateTimeISO().add({ seconds }).epochMilliseconds

    const reply = yield * pipe(
      this.redisService.multi(),
      t => participants.reduce(
        (t, participant) => t
          .zAdd(_participants.key, { score, value: participant }, { CH: true, GT: true, XX: true }),
        t,
      ),
      t => t.expire(_participants.key, this.defaultConversationExpire.total('seconds'), 'GT'),
      t => participants
        .reduce(
          (t, participant) => t
            .expire(
              this.entityConversationService.getParticipantConversations(this.type, participant).key,
              seconds,
              'GT',
            ),
          t,
        ),
      t => call(t.exec()),
    )

    return pipe(
      reply,
      readonlyArray.takeLeft(participants.length),
      readonlyArray.zip(participants),
      readonlyArray.filterMap(
        ([reply, participant]) => 1 === reply ? option.some(participant) : option.none,
      ),
    )
  }

  private *expireParticipantsByEvent(event: Extract<user.Event, { type: 'expire' }>) {
    const conversations = yield * this.fetchConversationMap(event.users)

    yield * all(pipe(
      conversations,
      readonlyRecord.toReadonlyArray,
      readonlyArray.map(
        ([conversation, participants]) => this.expireParticipants(conversation, participants, event.data.expire),
      ),
    ))
  }

  private *listenUserEvent() {
    const event = this.entityUserService.getEvent()
    const parallelGroup = new group.Parallel(event, `${this.type}.conversation`)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _this = this

    yield * parallelGroup.read(randomUUID(), function*({ message }) {
      yield * pipe(
        match(message)
          .with({ type: 'expire' }, x => [x, _this.participantsExpireCallbacks] as const)
          .with({ type: 'register' }, x => [x, _this.participantsRegisterCallbacks] as const)
          .with({ type: 'unregister' }, x => [x, _this.participantsUnregisterCallbacks] as const)
          .exhaustive(),
        ([message, callbacks]) =>
          (callbacks.map(identity.ap(message as any))) as Operation<any>[],
        all,
      )
    })
  }

  private post(conversation: string, message: Conversations.Message) {
    const records = this.entityConversationService.getRecords(this.type, conversation)

    return records.add(
      '*',
      message,
      { NOMKSTREAM: true, TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } },
    )
  }

  private *removeParticipantsByEvent(event: Extract<user.Event, { type: 'unregister' }>) {
    const conversations = yield * this.fetchConversationMap(event.users)

    yield * all(pipe(
      conversations,
      readonlyRecord.toReadonlyArray,
      readonlyArray.map(
        ([conversation, participants]) => this.removeParticipants(conversation, participants),
      ),
    ))
  }
}
