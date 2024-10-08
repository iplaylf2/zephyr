import { Inject, Injectable } from '@nestjs/common'
import { PrismaClient, PrismaTransaction } from '../../repositories/prisma/client.js'
import { call, sleep } from 'effection'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { option, readonlyArray, task } from 'fp-ts'
import { UserService as EntityUserService } from '../../repositories/redis/entities/user.service.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { Temporal } from 'temporal-polyfill'
import { User } from '../../repositories/prisma/generated/index.js'
import { cOperation } from '../../common/fp-effection/c-operation.js'
import { coerceReadonly } from '../../utils/identity.js'
import { readonlyRecordPlus } from '../../kits/fp-ts/readonly-record-plus.js'
import { user } from '../../models/user.js'
import { where } from '../../repositories/prisma/common/where.js'

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

  public active(users: readonly number[]) {
    return this.prismaClient.$callTransaction(tx =>
      function*(this: UserService) {
        const _users = yield * tx.$user().forUpdate(users)

        yield * call(tx.user.updateMany({
          data: {
            lastActiveAt: new Date(),
          },
          where: { id: { in: where.writable(_users) } },
        }))

        return _users
      }.bind(this),
    )
  }

  public exists(
    users: readonly number[],
    tx: PrismaTransaction = this.prismaClient,
  ) {
    return tx.$user().forQuery(users)
  }

  public expire(
    users: readonly number[],
    seconds = this.defaultExpire.total('seconds'),
  ) {
    const interval = `${seconds.toFixed(0)} seconds`

    return this.prismaClient.$callTransaction(tx =>
      function*(this: UserService) {
        const now = new Date()

        const _users = yield * pipe(
          users,
          readonlyArray.map(
            user => () => tx.$queryRaw<Pick<User, 'expiredAt' | 'id'>[]>`
              update users 
              set
                "expiredAt" = users."lastActiveAt" + ${interval}::interval
              where
                ${now} < users."expiredAt" and
                users."expiredAt" < users."lastActiveAt" + ${interval}::interval and
                users.id = ${user}
              returning
                users."expiredAt", users.id`,
          ),
          task.sequenceArray,
          cOperation.FromTask.fromTask,
          cOperation.map(
            readonlyArray.filterMap(flow(
              readonlyArray.head,
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

        return _users.map(x => x.id)
      }.bind(this),
    )
  }

  public get(users: readonly number[]) {
    return pipe(
      () => this.prismaClient.user.findMany({
        where: {
          expiredAt: { gt: new Date() },
          id: { in: where.writable(users) },
        },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(coerceReadonly),
    )()
  }

  public *patch(id: number, user: Partial<user.Info>) {
    if ('name' in user) {
      try {
        yield * call(this.prismaClient.user.update({
          data: {
            id,
            lastActiveAt: new Date(),
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

  public register(info: user.Info) {
    return this.prismaClient.$callTransaction(tx =>
      function*(this: UserService) {
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
      }.bind(this),
    )
  }

  public unregister(users: readonly number[]) {
    return this.prismaClient.$callTransaction(tx =>
      function*(this: UserService) {
        const ids = yield * tx.$user().forScale(users)

        if (0 === ids.length) {
          return []
        }

        yield * call(tx.user.deleteMany({
          where: { id: { in: where.writable(ids) } },
        }))

        yield * this.postUserEvent({
          timestamp: Date.now(),
          type: 'unregister',
          users: ids,
        })

        return ids
      }.bind(this),
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
      const halfExpiredUsers = yield * pipe(
        () => this.prismaClient.user.findMany({
          select: { id: true },
          where: where.halfLife(this.defaultExpire),
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
