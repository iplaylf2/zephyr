import { Inject, Injectable } from '@nestjs/common'
import { call, run } from 'effection'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { option, predicate, readonlyArray, readonlyRecord } from 'fp-ts'
import { UserService as EntityUserService } from '../../repositories/redis/entities/user.service.js'
import { PrismaService } from '../../repositories/prisma/prisma.service.js'
import { RedisService } from '../../repositories/redis/redis.service.js'
import { Temporal } from 'temporal-polyfill'
import { user } from '../../models/user.js'
import { ioOperation } from '../../common/fp-effection/io-operation.js'
import { coerceReadonly, unsafeCoerce } from '../../utils/identity.js'

@Injectable()
export class UserService {
  @Inject()
  private readonly entityUserService!: EntityUserService

  @Inject()
  private readonly prismaService!: PrismaService

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

  public get(users: readonly number[]) {
    return pipe(
      () => call(this.prismaService.user.findMany({
        where: { id: { in: users.concat() } },
      })),
      ioOperation.map(coerceReadonly),
    )()
  }

  public *put(id: number, user: Partial<user.Info>) {
    if ('name' in user) {
      yield * call(this.prismaService.user.update({
        data: {
          name: user.name,
        },
        select: {},
        where: { id },
      }))

      return true
    }

    return false
  }

  public *register(info: user.Info) {
    const now = Temporal.Now.zonedDateTimeISO()
    const createdAt = new Date(now.epochMilliseconds)

    const user = yield * call(this.prismaService.user.create({
      data: {
        createdAt,
        expiredAt: now.add(this.defaultExpire).toString(),
        name: info.name,
      },
      select: { id: true },
    }))

    yield * this.entityUserService.getEvent()
      .add(
        '*',
        {
          data: {
            expire: this.defaultExpire.total('microseconds'),
            timestamp: createdAt.valueOf(),
          },
          type: 'register',
          user: user.id,
        },
        {
          NOMKSTREAM: true,
          TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 },
        },
      )

    return user.id
  }

  public *unregister(users: readonly number[]) {
    const ids = yield * call(
      this.prismaService.$transaction(tx => run(function*() {
        const _users = yield * call(tx.user.findMany({
          select: { id: true },
          where: { id: { in: users.concat() } },
        }))

        const ids = _users.map(x => x.id)

        yield * call(tx.user.deleteMany(
          { where: { id: { in: ids } } },
        ))

        return ids
      })),
    )

    yield * this.entityUserService.getEvent().add(
      '*',
      { data: { timestamp: Date.now() }, type: 'unregister', users: ids },
      {
        NOMKSTREAM: true,
        TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 },
      },
    )

    return ids
  }
}
