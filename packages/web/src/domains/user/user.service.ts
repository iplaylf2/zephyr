import { Inject, Injectable } from '@nestjs/common'
import { Operation, call } from 'effection'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { option, predicate, readonlyArray, readonlyRecord } from 'fp-ts'
import { UserService as EntityUserService } from '../../repositories/redis/entities/user.service.js'
import { RedisService } from '../../repositories/redis/redis.service.js'
import { Temporal } from 'temporal-polyfill'
import { randomUUID } from 'crypto'
import { user } from '../../models/user.js'

@Injectable()
export class UserService {
  @Inject()
  private readonly entityUserService!: EntityUserService

  @Inject()
  private readonly redisService!: RedisService

  public readonly defaultExpire = Temporal.Duration.from({ days: 1 })

  public *exists(users: readonly string[]) {
    const _users = this.entityUserService.get()

    const reply = yield * _users.mScore(users)

    return pipe(
      reply,
      readonlyArray.zip(users),
      readonlyArray.filterMap(
        ([reply, user]) => Date.now() < (reply ?? 0) ? option.some(user) : option.none,
      ),
    )
  }

  public *expire(users: readonly string[], seconds: number = this.defaultExpire.total('seconds')) {
    const _users = this.entityUserService.get()
    const timestamp = Temporal.Now.zonedDateTimeISO()
    const score = timestamp.add({ seconds }).epochMilliseconds

    const reply = yield * pipe(
      this.redisService.multi()
        .zRemRangeByScore(_users.key, 0, timestamp.epochMilliseconds),
      t => users.reduce(
        (t, user) => t
          .zAdd(_users.key, { score, value: user }, { CH: true, GT: true, XX: true }),
        t,
      ),
      t => users.reduce(
        (t, user) => t
          .expire(this.entityUserService.getInfo(user).key, seconds, 'GT'),
        t,
      ),
      t => call(t.exec()),
    )

    const existsUsers = pipe(
      reply,
      readonlyArray.dropLeft(1),
      readonlyArray.takeLeft(users.length),
      readonlyArray.zip(users),
      readonlyArray.filterMap(
        ([reply, user]) => 1 === reply ? option.some(user) : option.none,
      ),
    )

    if (0 === existsUsers.length) {
      return []
    }

    yield * this.entityUserService.getEvent()
      .add(
        '*',
        {
          data: { expire: seconds, timestamp: timestamp.epochMilliseconds },
          type: 'expire',
          users: existsUsers,
        },
        { NOMKSTREAM: true, TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } },
      )

    return existsUsers
  }

  public *get(users: readonly string[]) {
    const reply = yield * pipe(
      this.redisService.multi(),
      t => users.reduce(
        (t, id) => t
          .hGetAll(this.entityUserService.getInfo(id).key),
        t,
      ),
      t => call(t.exec()),
    )

    const forDecoding = this.entityUserService.getInfo('for-decoding')

    return pipe(
      readonlyArray.zip(users, reply),
      readonlyArray.filterMap(
        ([id, reply]) => pipe(
          reply as Record<any, any>,
          option.fromPredicate(
            predicate.not(readonlyRecord.isEmpty),
          ),
          option.map(flow(
            x => forDecoding.decodeFully(x),
            x => ({ ...x, id } as user.Info & { readonly id: string })),
          )),
      ),
    )
  }

  public *put(id: string, user: Partial<user.Info>) {
    const info = this.entityUserService.getInfo(id)

    yield * call(
      this.redisService.multi()
        .hSet(info.key, info.encodeFully(user))
        .expire(info.key, this.defaultExpire.total('seconds'), 'GT')
        .exec(),
    )
  }

  public *register(info: user.Info, retry = 2): Operation<string | null> {
    const users = this.entityUserService.get()
    const registerAt = Temporal.Now.zonedDateTimeISO()
    const expireAt = registerAt.add(this.defaultExpire)
    const id = randomUUID()

    const reply = yield * users.add([{ score: expireAt.epochMilliseconds, value: id }], { NX: true })

    if (1 !== reply) {
      if (0 < retry) {
        return yield * this.register(info, retry - 1)
      }

      return null
    }

    const entityInfo = this.entityUserService.getInfo(id)
    const expire = this.defaultExpire.total('seconds')

    yield * call(this.redisService.multi()
      .hSet(entityInfo.key, entityInfo.encodeFully(info))
      .expire(entityInfo.key, expire)
      .exec(),
    )

    yield * this.entityUserService.getEvent()
      .add(
        '*',
        {
          data: { expire, timestamp: registerAt.epochMilliseconds },
          type: 'register',
          user: id,
        },
        { NOMKSTREAM: true, TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } },
      )

    return id
  }

  public *unregister(users: readonly string[]) {
    const _users = this.entityUserService.get()
    const unregisterAt = Temporal.Now.zonedDateTimeISO()

    const reply = yield * pipe(
      this.redisService.multi()
        .zRemRangeByScore(_users.key, 0, unregisterAt.epochMilliseconds),
      t => users.reduce(
        (t, user) => t
          .zRem(_users.key, user),
        t,
      ),
      t => call(t.exec()),
    )

    const unregisterUsers = pipe(
      reply,
      readonlyArray.dropLeft(1),
      readonlyArray.zip(users),
      readonlyArray.filterMap(
        ([reply, user]) => 1 === reply ? option.some(user) : option.none,
      ),
    )

    if (0 === unregisterUsers.length) {
      return []
    }

    yield * this.entityUserService.getEvent()
      .add(
        '*',
        { data: { timestamp: unregisterAt.epochMilliseconds }, type: 'unregister', users: unregisterUsers },
        { NOMKSTREAM: true, TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 } },
      )

    return unregisterUsers
  }
}
