import { Inject, Injectable } from '@nestjs/common'
import { PrismaClient, User } from '../../generated/prisma/index.js'
import { call, run } from 'effection'
import { UserService as EntityUserService } from '../../repositories/redis/entities/user.service.js'
import { Temporal } from 'temporal-polyfill'
import { coerceReadonly } from '../../utils/identity.js'
import { cOperation } from '../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'
import { user } from '../../models/user.js'

@Injectable()
export class UserService {
  @Inject()
  private readonly entityUserService!: EntityUserService

  @Inject()
  private readonly prismaClient!: PrismaClient

  public readonly defaultExpire = Temporal.Duration.from({ days: 1 })

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

  public expire(
    users: readonly number[],
     seconds: number = this.defaultExpire.total('seconds'),
  ) {
    return call(
      this.prismaClient.$transaction(tx => run(function*(this: UserService) {
        const _users = yield * call(tx.$queryRaw<Pick<User, 'id'>[]>`
          select id
          from User
          where 
            ${Date.now()} < expiredAt and
            id in ${users} for update
        `)

        const now = Temporal.Now.zonedDateTimeISO()
        const ids = _users.map(x => x.id)

        // _users.map(
        //   readonlyRecordPlus.upsertAt(
        //     'expireAt',
        //     pipe(
        //       now
        //         .add({ seconds })
        //         .epochMilliseconds,
        //       x => new Date(x),
        //     ),
        //   ),
        // )

        yield * this.postUserEvent({
          data: { expire: seconds, timestamp: now.epochMilliseconds },
          type: 'expire',
          users: ids,
        })

        return ids
      }.bind(this))),
    )
  }

  public get(users: readonly number[]) {
    return pipe(
      () => this.prismaClient.user.findMany({
        where: { id: { in: users.concat() } },
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

  public register(info: user.Info) {
    return call(
      this.prismaClient.$transaction(tx => run(function*(this: UserService) {
        const now = Temporal.Now.zonedDateTimeISO()
        const createdAt = new Date(now.epochMilliseconds)
        const expiredAt = new Date(now.add(this.defaultExpire).epochMilliseconds)

        const user = yield * call(tx.user.create({
          data: {
            createdAt,
            expiredAt,
            name: info.name,
          },
          select: { id: true },
        }))

        yield * this.postUserEvent({
          data: {
            expire: this.defaultExpire.total('seconds'),
            timestamp: createdAt.valueOf(),
          },
          type: 'register',
          user: user.id,
        })

        return user.id
      }.bind(this))),
    )
  }

  public unregister(users: readonly number[]) {
    return call(
      this.prismaClient.$transaction(tx => run(function*(this: UserService) {
        const _users = yield * call(tx.$queryRaw<Pick<User, 'id'>[]>`
          select id 
          from User 
          where 
            ${Date.now()} < expiredAt and
            id in ${users}
          for update
        `)

        const ids = _users.map(x => x.id)

        yield * call(tx.user.deleteMany({
          where: { id: { in: ids } },
        }))

        yield * this.postUserEvent({
          data: { timestamp: Date.now() },
          type: 'unregister',
          users: ids,
        })

        return ids
      }.bind(this))),
    )
  }

  private postUserEvent(event: user.Event) {
    return this.entityUserService.getEvent().add(
      '*',
      event,
      {
        NOMKSTREAM: true,
        TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 1000 },
      },
    )
  }
}
