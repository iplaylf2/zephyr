import { Inject, Injectable } from '@nestjs/common'
import { PrismaClient, PushReceiver } from '../../repositories/prisma/generated/index.js'
import { call, sleep, useScope } from 'effection'
import { readonlyArray, task } from 'fp-ts'
import { PushService as EntityPushService } from '../../repositories/redis/entities/push.service.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { Temporal } from 'temporal-polyfill'
import { cOperation } from '../../common/fp-effection/c-operation.js'
import { commonWhere } from '../../repositories/prisma/common/common-where.js'
import { pipe } from 'fp-ts/lib/function.js'

@Injectable()
export class PushService extends ModuleRaii {
  @Inject()
  private readonly entityPushService!: EntityPushService

  @Inject()
  private readonly prismaClient!: PrismaClient

  public readonly defaultExpire = Temporal.Duration.from({ hours: 1 })

  public constructor() {
    super()

    void this.entityPushService
    this.initializeCallbacks.push(() => this.expireReceiversEfficiently())
    this.initializeCallbacks.push(() => this.deleteExpiredPushes())
    this.initializeCallbacks.push(() => this.deleteExpiredReceivers())
  }

  public *expireReceivers(
    receivers: readonly number[],
    seconds = this.defaultExpire.total('seconds'),
  ) {
    const scope = yield * useScope()

    return yield * call(
      this.prismaClient.$transaction(tx => scope.run(function*(this: PushService) {
        const interval = `${seconds.toFixed(0)} seconds`
        const now = new Date()

        const _receivers = yield * pipe(
          receivers,
          readonlyArray.map(
            receiver => () => tx.$queryRaw<Pick<PushReceiver, 'expiredAt' | 'id'>[]>`
              update "push-receivers" r
              set
                "expiredAt" = r."lastActiveAt" + ${interval}::interval
              where
                ${now} < r."expiredAt" and
                r."expiredAt" < r."lastActiveAt" + ${interval}::interval and
                r.id = ${receiver}
              returning
                r."expiredAt", r.id`,
          ),
          task.sequenceArray,
          cOperation.FromTask.fromTask,
          cOperation.map(
            readonlyArray.filterMap(readonlyArray.head),
          ),
        )()

        yield * pipe(
          _receivers,
          readonlyArray.map(
            ({ expiredAt, id }) => () => tx.$executeRaw`
              update pushes
              set
                "expiredAt" = ${expiredAt}
              from
                "push-subscriptions" s
              where
                s.push = pushes.id and
                ${now} < pushes."expiredAt" and
                pushes."expiredAt" < ${expiredAt} and
                s.receiver = ${id}`,
          ),
          task.sequenceArray,
          cOperation.FromTask.fromTask,
        )()

        return _receivers.map(x => x.id)
      })),
    )
  }

  public patchPushes() {
  }

  public postReceiver(claimer: number | null) {
    const now = Temporal.Now.zonedDateTimeISO()
    const createdAt = new Date(now.epochMilliseconds)
    const expiredAt = new Date(now.add(this.defaultExpire).epochMilliseconds)

    return call(this.prismaClient.pushReceiver.create({
      data: {
        claimer,
        createdAt,
        expiredAt,
        lastActiveAt: createdAt,
      },
      select: { id: true, token: true },
    }))
  }

  public *putReceiver(claimer: number) {
    const receiver = yield * call(this.prismaClient.pushReceiver.findUnique({
      select: { expiredAt: true, id: true, token: true },
      where: { claimer },
    }))

    if (receiver) {
      if (new Date() < receiver.expiredAt) {
        return receiver // fixme: pick
      }

      yield * call(this.prismaClient.pushReceiver.delete({
        where: { token: receiver.token },
      }))
    }

    return yield * this.postReceiver(claimer)
  }

  private *deleteExpiredPushes() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      yield * call(this.prismaClient.push.deleteMany({
        where: { expiredAt: { lte: new Date() } },
      }))

      yield * sleep(interval)
    }
  }

  private *deleteExpiredReceivers() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      yield * call(this.prismaClient.pushReceiver.deleteMany({
        where: { expiredAt: { lte: new Date() } },
      }))

      yield * sleep(interval)
    }
  }

  private *expireReceiversEfficiently() {
    const interval = Temporal.Duration
      .from({ minutes: 1 })
      .total('milliseconds')

    while (true) {
      const receivers = yield * pipe(
        () => this.prismaClient.pushReceiver.findMany({
          select: { id: true },
          where: commonWhere.halfLife(this.defaultExpire),
        }),
        cOperation.FromTask.fromTask,
        cOperation.map(
          readonlyArray.map(x => x.id),
        ),
      )()

      if (0 < receivers.length) {
        yield * this.expireReceivers(receivers)
      }

      yield * sleep(interval)
    }
  }
}
