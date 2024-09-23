import { Inject, Injectable } from '@nestjs/common'
import { Prisma, PrismaClient, User } from '../../repositories/prisma/generated/index.js'
import { call, sleep, useScope } from 'effection'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { option, readonlyArray, task } from 'fp-ts'
import { UserService as EntityUserService } from '../../repositories/redis/entities/user.service.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { Temporal } from 'temporal-polyfill'
import { cOperation } from '../../common/fp-effection/c-operation.js'
import { coerceReadonly } from '../../utils/identity.js'
import { readonlyRecordPlus } from '../../kits/fp-ts/readonly-record-plus.js'
import { user } from '../../models/user.js'

@Injectable()
export class UserService extends ModuleRaii {
  @Inject()
  private readonly entityUserService!: EntityUserService

  @Inject()
  private readonly prismaClient!: PrismaClient

  public readonly defaultExpire = Temporal.Duration.from({ days: 1 })

  public constructor() {
    super()

    this.initializeCallbacks.push(() => this.expireUsersEfficiently())
    this.initializeCallbacks.push(() => this.deleteExpiredUsers())
  }

  public exists(users: readonly number[]) {
    return pipe(
      () => this.prismaClient.user.findMany({
        select: { id: true },
        where: {
          expiredAt: { gt: new Date() },
          id: { in: users.concat() },
        },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  }

  public *expire(
    users: readonly number[],
    seconds: number = this.defaultExpire.total('seconds'),
  ) {
    const interval = `${seconds.toFixed(0)} seconds`

    const scope = yield * useScope()

    return yield * call(
      this.prismaClient.$transaction(tx => scope.run(function*(this: UserService) {
        const now = new Date()

        const _users = yield * pipe(
          users,
          readonlyArray.map(
            user => () => tx.$queryRaw<Pick<User, 'expiredAt' | 'id'> | null>`
              update
                users 
              set
                expiredAt = users.lastActiveAt + ${interval}::interval
              from 
                users
              where
                ${now} < expiredAt and
                id = ${user}
              returning
                users.expiredAt, users.id`,
          ),
          task.sequenceArray,
          cOperation.FromTask.fromTask,
          cOperation.map(
            readonlyArray.filterMap(flow(
              option.fromNullable,
              option.map(
                readonlyRecordPlus.modifyAt('expiredAt', x => x.valueOf()),
              ),
            )),
          ),
        )()

        if (0 === _users.length) {
          return []
        }

        yield * this.postUserEvent({
          type: 'expire',
          users: _users,
        })

        return _users
      }.bind(this))),
    )
  }

  public get(users: readonly number[]) {
    return pipe(
      () => this.prismaClient.user.findMany({
        where: {
          expiredAt: { gt: new Date() },
          id: { in: users.concat() },
        },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(coerceReadonly),
    )()
  }

  public *put(id: number, user: Partial<user.Info>) {
    if ('name' in user) {
      try {
        yield * call(this.prismaClient.user.update({
          data: {
            id,
            name: user.name,
          },
          select: {},
          where: { id },
        }))

        return true
      }
      catch {
        return false
      }
    }

    return false
  }

  public *putLastActiveAt(users: readonly number[]) {
    const now = new Date()

    const scope = yield * useScope()

    return yield * call(
      this.prismaClient.$transaction(tx => scope.run(function*(this: UserService) {
        const _users = yield * this.selectValidUsersForUpdate(tx, users)

        yield * call(tx.user.updateMany({
          data: {
            lastActiveAt: now,
          },
          where: { id: { in: _users.concat() } },
        }))

        return _users
      }.bind(this))),
    )
  }

  public *register(info: user.Info) {
    const scope = yield * useScope()

    return yield * call(
      this.prismaClient.$transaction(tx => scope.run(function*(this: UserService) {
        const now = Temporal.Now.zonedDateTimeISO()
        const createdAt = new Date(now.epochMilliseconds)
        const expiredAt = new Date(now.add(this.defaultExpire).epochMilliseconds)

        const user = yield * pipe(
          () => tx.user.create({
            data: {
              createdAt,
              expiredAt,
              lastActiveAt: createdAt,
              name: info.name,
            },
            select: { id: true },
          }),
          task.map(x => x.id),
          cOperation.FromTask.fromTask,
        )()

        yield * this.postUserEvent({
          timestamp: createdAt.valueOf(),
          type: 'register',
          user: user,
        })

        return user
      }.bind(this))),
    )
  }

  public selectUsersForUpdate(tx: Prisma.TransactionClient, users: readonly number[]) {
    return pipe(
      () => tx.$queryRaw<Pick<User, 'id'>[]>`
        select
          id
        from 
          users
        where
          id in ${Prisma.join(users)}
        for update`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  }

  public selectValidUsersForUpdate(tx: Prisma.TransactionClient, users: readonly number[]) {
    return pipe(
      () => tx.$queryRaw<Pick<User, 'id'>[]>`
        select
          id
        from 
          users
        where 
          ${Date.now()} < expiredAt and
          id in ${Prisma.join(users)}
        for update`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  }

  public *unregister(users: readonly number[]) {
    const scope = yield * useScope()

    return yield * call(
      this.prismaClient.$transaction(tx => scope.run(function*(this: UserService) {
        const ids = yield * this.selectUsersForUpdate(tx, users)

        if (0 === ids.length) {
          return []
        }

        yield * call(tx.user.deleteMany({
          where: { id: { in: ids.concat() } },
        }))

        yield * this.postUserEvent({
          timestamp: Date.now(),
          type: 'unregister',
          users: ids,
        })

        return ids
      }.bind(this))),
    )
  }

  private *deleteExpiredUsers() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      const expiredUsers = yield * pipe(
        () => this.prismaClient.user.findMany({
          select: { id: true },
          where: { expiredAt: { lte: new Date() } },
        }),
        cOperation.FromTask.fromTask,
        cOperation.map(
          readonlyArray.map(x => x.id),
        ),
      )()

      if (0 < expiredUsers.length) {
        yield * this.unregister(expiredUsers)
      }

      yield * sleep(interval)
    }
  }

  private *expireUsersEfficiently() {
    const interval = Temporal.Duration
      .from({ minutes: 1 })
      .total('milliseconds')

    while (true) {
      const halfSeconds = this.defaultExpire.total('seconds') / 2
      const halfExpiredAt = Temporal.Now
        .zonedDateTimeISO()
        .add({ seconds: halfSeconds })

      const halfExpiredUsers = yield * pipe(
        () => this.prismaClient.user.findMany({
          select: { id: true },
          where: {
            AND: [
              { expiredAt: { gt: new Date() } },
              { expiredAt: { lte: new Date(halfExpiredAt.epochMilliseconds) } },
            ],
            lastActiveAt: {
              gt: new Date(
                halfExpiredAt.subtract(this.defaultExpire).epochMilliseconds,
              ),
            },
          },
        }),
        cOperation.FromTask.fromTask,
        cOperation.map(
          readonlyArray.map(x => x.id),
        ),
      )()

      if (0 < halfExpiredUsers.length) {
        yield * this.expire(halfExpiredUsers)
      }

      yield * sleep(interval)
    }
  }

  private postUserEvent(event: user.Event) {
    return pipe(
      this.entityUserService.getEvent(),
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
