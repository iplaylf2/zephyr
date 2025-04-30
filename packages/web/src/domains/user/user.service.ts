import { Inject, Injectable } from '@nestjs/common'
import { all, call, sleep } from 'effection'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { identity, readonlyArray } from 'fp-ts'
import { Directive } from '@zephyr/kit/effection/operation.js'
import { DrizzleService } from '../../repositories/drizzle/drizzle.service.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { UserService as RedisUserService } from '../../repositories/redis/schemas/user.service.js'
import { Temporal } from 'temporal-polyfill'
import { UserEvent } from './entities/user-event.js'
import { UserInfo } from './entities/user-info.js'
import { coerceReadonly } from '../../utils/identity.js'
import { group } from '../../repositories/redis/commands/stream/group.js'
import { match } from 'ts-pattern'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { randomUUID } from 'node:crypto'

@Injectable()
export class UserService extends ModuleRaii {
  @Inject()
  private readonly drizzleService!: DrizzleService

  @Inject()
  private readonly redisUserService!: RedisUserService

  public readonly defaultExpire = Temporal.Duration.from({ days: 1 })

  private readonly expireCallbacks
    = new Array<(event: Extract<UserEvent, { type: 'expire' }>) => Directive<any>>()

  private readonly unregisterCallbacks
    = new Array<(event: Extract<UserEvent, { type: 'unregister' }>) => Directive<any>>()

  public constructor() {
    super()

    this.initializeCallbacks.push(() => this.deleteExpiredUsers())
    this.initializeCallbacks.push(() => this.listenEvent())
    this.expireCallbacks.push(({ users, expiredAt }) => this.expire(users, expiredAt))
  }

  public* active(users: readonly number[]) {
  }

  public exists(
    users: readonly number[],
    tx: PrismaTransaction = this.prismaClient,
  ) {
    return tx.$user().forQuery(users)
  }

  public get(users: readonly number[]) {
    return pipe(
      () => this.prismaClient.user.findMany({
        where: {
          expiredAt: { gt: new Date() },
          id: { in: where.writable(users) },
        },
      }),
      plan.FromTask.fromTask,
      plan.map(coerceReadonly),
    )()
  }

  public* patch(id: number, info: Omit<UserInfo, 'id'>) {
    try {
      yield* call(
        () => this.prismaClient.user.update({
          data: {
            id,
            name: info.name,
          },
          select: {},
          where: { id },
        }),
      )

      return true
    }
    catch {
      return false
    }
  }

  public* register(info: Omit<UserInfo, 'id'>) {
    const now = Temporal.Now.zonedDateTimeISO()
    const createdAt = new Date(now.epochMilliseconds)
    const expiredAt = new Date(now.add(this.defaultExpire).epochMilliseconds)

    return yield* pipe(
      () => this.prismaClient.user.create({
        data: {
          createdAt,
          expiredAt,
          name: info.name,
        },
        select: { id: true },
      }),
      plan.FromTask.fromTask,
      plan.map(x => x.id),
    )()
  }

  public unregister(users: readonly number[]) {
    return this.prismaClient.$callTransaction(
      function* (this: UserService, tx: PrismaTransaction) {
        const ids = yield* tx.$user().forScale(users)

        if (0 === ids.length) {
          return []
        }

        yield* call(
          () => tx.user.deleteMany({
            where: { id: { in: where.writable(ids) } },
          }),
        )

        yield* this.postUserEvent({
          timestamp: Date.now(),
          type: 'unregister',
          users: ids,
        })

        return ids
      }.bind(this),
    )
  }

  private* deleteExpiredUsers() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      const expiredUsers = yield* pipe(
        () => this.prismaClient.user.findMany({
          select: { id: true },
          where: { expiredAt: { lte: new Date() } },
        }),
        plan.FromTask.fromTask,
        plan.map(
          readonlyArray.map(x => x.id),
        ),
      )()

      if (0 < expiredUsers.length) {
        yield* this.unregister(expiredUsers)
      }

      yield* sleep(interval)
    }
  }

  private* expire(users: readonly number[], expiredAt: number) {
    yield* call(() => this.prismaClient.user.updateMany({
      data: {
        expiredAt: new Date(expiredAt),
      },
      where: {
        expiredAt: { gt: new Date() },
        id: { in: where.writable(users) },
      },
    }))
  }

  private* listenEvent() {
    const event = this.redisUserService.getEvent()
    const parallelGroup = new group.Parallel(event, `user`)

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
          .with({ type: 'expire' }, messageHandlerAp(this.expireCallbacks))
          .with({ type: 'unregister' }, messageHandlerAp(this.unregisterCallbacks))
          .exhaustive(),
        all,
      ),
    )
  }

  private postUserEvent(event: UserEvent) {
    return pipe(
      this.redisUserService.getEvent(),
      x => x.add(
        '*',
        event,
        {
          NOMKSTREAM: true,
          TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 },
        },
      ),
    )
  }
}
