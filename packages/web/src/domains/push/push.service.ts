import { Inject, Injectable } from '@nestjs/common'
import { call, sleep } from 'effection'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { identity, number, readonlyArray, task } from 'fp-ts'
import { PushService as EntityPushService } from '../../repositories/redis/entities/push.service.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { PrismaClient } from '../../repositories/prisma/client.js'
import { PushReceiver } from '../../repositories/prisma/generated/index.js'
import { Temporal } from 'temporal-polyfill'
import { cOperation } from '../../common/fp-effection/c-operation.js'
import { dialogueValidator } from './subscriptions/dialogue.js'
import { groupValidator } from './subscriptions/group.js'
import { match } from 'ts-pattern'
import { where } from '../../repositories/prisma/common/where.js'
import { z } from 'zod'
import { zPlus } from '../../kits/z-plus.js'

@Injectable()
export class PushService extends ModuleRaii {
  @Inject()
  private readonly entityPushService!: EntityPushService

  @Inject()
  private readonly prismaClient!: PrismaClient

  public readonly defaultExpire = Temporal.Duration.from({ hours: 1 })

  public constructor() {
    super()

    this.initializeCallbacks.push(() => this.expireReceiversEfficiently())
    this.initializeCallbacks.push(() => this.deleteExpiredPushes())
    this.initializeCallbacks.push(() => this.deleteExpiredReceivers())
  }

  public active(receivers: readonly number[]) {
    return this.prismaClient.$callTransaction(tx =>
      function*(this: PushService) {
        const _receivers = yield * tx.$pushReceiver().forUpdate(receivers)

        yield * call(tx.pushReceiver.updateMany({
          data: {
            lastActiveAt: new Date(),
          },
          where: { id: { in: where.writable(_receivers) } },
        }))

        return _receivers
      }.bind(this),
    )
  }

  public *deleteSubscriptions(receiver: number, type: string, pushes: readonly number[]) {
    if (0 === pushes.length) {
      return []
    }

    const exists = yield * this.existsReceivers([receiver])

    if (0 === exists.length) {
      return []
    }

    const _pushes = yield * pipe(
      () => this.prismaClient.push.findMany({
        select: { id: true, source: true },
        where: {
          expiredAt: { gt: new Date() },
          source: { in: where.writable(pushes) },
          type,
        },
      }),
      cOperation.FromTask.fromTask,
    )()

    return yield * this.prismaClient.$callTransaction(tx =>
      function*(this: PushService) {
        const toDelete = yield * tx
          .$pushSubscription()
          .pushesForScale(receiver, _pushes.map(x => x.id))

        yield * call(tx.pushSubscription.deleteMany({
          where: { push: { in: where.writable(toDelete) }, receiver },
        }))

        const pushRecord = Object.fromEntries(_pushes.map(x => [x.id, x.source] as const))

        {
          const pushes = toDelete.map(x => pushRecord[x]!)
          const notification = this.entityPushService.getNotification()

          yield * notification.publish(
            notification.getChannel(receiver),
            { push: { sources: pushes, type }, type: 'unsubscribe' },
          )

          return pushes
        }
      }.bind(this),
    )
  }

  public existsReceivers(receivers: readonly number[]) {
    return this.prismaClient.$pushReceiver().forQuery(receivers)
  }

  public expireReceivers(
    receivers: readonly number[],
    seconds = this.defaultExpire.total('seconds'),
  ) {
    return this.prismaClient.$callTransaction(tx =>
      function*(this: PushService) {
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
      }.bind(this),
    )
  }

  public *patchSubscriptions(receiver: number, type: string, pushes: readonly number[]) {
    if (0 === pushes.length) {
      return []
    }

    const exists = yield * this.existsReceivers([receiver])

    if (0 === exists.length) {
      return []
    }

    const invalid = yield * this.validateSubscriptions(receiver, type, pushes)

    if (0 !== invalid.length) {
      throw new Error()
    }

    const now = Temporal.Now.zonedDateTimeISO()
    const expiredAt = new Date(now.add(this.defaultExpire).epochMilliseconds)

    const _pushes = yield * pipe(
      pushes,
      readonlyArray.map(source => pipe(
        () => this.prismaClient.push.upsert({
          create: { expiredAt, source, type },
          select: { id: true, source: true },
          update: { expiredAt },
          where: { rawId: { source, type } },
        }),
        cOperation.FromTask.fromTask,
      )),
      cOperation.sequenceArray,
    )()

    return this.prismaClient.$callTransaction(tx =>
      function*(this: PushService) {
        const pushesId = _pushes.map(x => x.id)

        const newPushes = yield * pipe(
          () => tx.$pushSubscription().pushesForScale(receiver, pushesId),
          cOperation.map(flow(
            a => (b: typeof a) => readonlyArray.difference(number.Eq)(b, a),
            identity.ap(pushesId),
          )),
        )()

        const now = new Date()

        yield * call(tx.pushSubscription.createMany({
          data: newPushes.map(push => ({
            createdAt: now,
            push,
            receiver,
          })),
        }))

        const pushRecord = Object.fromEntries(_pushes.map(x => [x.id, x.source] as const))

        const pushesSource = newPushes.map(x => pushRecord[x]!)
        const notification = this.entityPushService.getNotification()

        yield * notification.publish(
          notification.getChannel(receiver),
          { push: { sources: pushesSource, type }, type: 'unsubscribe' },
        )

        return pushesSource
      }.bind(this),
    )
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
        return zPlus(receiverSchema).parse(receiver)
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
          where: where.halfLife(this.defaultExpire),
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

  private validateSubscriptions(receiver: number, type: string, pushes: readonly number[]) {
    return match(type)
      .with(
        dialogueValidator.type,
        () => dialogueValidator.validate(this.prismaClient, receiver, pushes),
      )
      .with(
        groupValidator.type,
        () => groupValidator.validate(this.prismaClient, receiver, pushes),
      )
      .otherwise(cOperation.Pointed.of(pushes))
  }
}

const receiverSchema = z.object({
  id: z.custom<number>(),
  token: z.custom<string>(),
})
