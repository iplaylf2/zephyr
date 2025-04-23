import { Inject, Injectable } from '@nestjs/common'
import { PrismaClient, PrismaTransaction } from '../../repositories/prisma/client.js'
import { call, sleep } from 'effection'
import { either, identity, number, readonlyArray, task } from 'fp-ts'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { PushService as RedisPushService } from '../../repositories/redis/schemas/push.service.js'
import { Temporal } from 'temporal-polyfill'
import { dialogueValidator } from './aggregates/subscriptions/dialogue.js'
import { groupValidator } from './aggregates/subscriptions/group.js'
import { match } from 'ts-pattern'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { where } from '../../repositories/prisma/common/where.js'
import { z } from 'zod'
import { zPlus } from '@zephyr/kit/z-plus.js'

@Injectable()
export class PushService extends ModuleRaii {
  @Inject()
  private readonly prismaClient!: PrismaClient

  @Inject()
  private readonly redisPushService!: RedisPushService

  public readonly defaultExpire = Temporal.Duration.from({ hours: 1 })

  public constructor() {
    super()

    this.initializeCallbacks.push(() => this.deleteExpiredPushes())
    this.initializeCallbacks.push(() => this.deleteExpiredReceivers())
  }

  public active(receiverIdArray: readonly number[]) {

  }

  public deleteReceiver(receiverId: number) {
    return this.prismaClient.$callTransaction(
      function* (this: PushService, tx: PrismaTransaction) {
        yield* call(
          () => tx.pushReceiver.delete({
            select: {},
            where: { id: receiverId },
          }),
        )

        const notification = this.redisPushService.getNotification()

        yield* notification.publish(notification.getChannel(receiverId), { type: 'delete' })
      }.bind(this),
    )
  }

  public* deleteSubscriptions(receiverId: number, type: string, pushIdArray: readonly number[]) {
    if (0 === pushIdArray.length) {
      return []
    }

    const exists = yield* this.existsReceivers([receiverId])

    if (0 === exists.length) {
      return []
    }

    const existsPushes = yield* pipe(
      () => this.prismaClient.push.findMany({
        select: { id: true, source: true },
        where: {
          source: { in: where.writable(pushIdArray) },
          type,
        },
      }),
      plan.FromTask.fromTask,
    )()

    return yield* this.prismaClient.$callTransaction(
      function* (this: PushService, tx: PrismaTransaction) {
        const toDelete = yield* tx
          .$pushSubscription()
          .pushesForScale(receiverId, existsPushes.map(x => x.id))

        yield* call(
          () => tx.pushSubscription.deleteMany({
            where: { pushId: { in: where.writable(toDelete) }, receiverId },
          }),
        )

        const pushRecord = Object.fromEntries(existsPushes.map(x => [x.id, x.source] as const))
        const deletedSources = toDelete.map(x => pushRecord[x]!)
        const notification = this.redisPushService.getNotification()

        yield* notification.publish(
          notification.getChannel(receiverId),
          {
            pushes: deletedSources.map(source => ({ source, type })),
            type: 'unsubscribe',
          },
        )

        return deletedSources
      }.bind(this),
    )
  }

  public existsReceivers(receiverIdArray: readonly number[]) {
    return this.prismaClient.$pushReceiver().forQuery(receiverIdArray)
  }

  public expireReceivers(
    receiverIdArray: readonly number[],
    seconds = this.defaultExpire.total('seconds'),
  ) {
  }

  public getClaimerReceiver(claimer: number) {
    return pipe(
      () => this.prismaClient.pushReceiver.findUnique({
        select: { id: true },
        where: { claimer, expiredAt: { gt: new Date() } },
      }),
      plan.FromTask.fromTask,
      plan.map(x => x?.id ?? null),
    )()
  }

  public getClaimerReceiverToken(claimer: number) {
    return pipe(
      () => this.prismaClient.pushReceiver.findUnique({
        select: { token: true },
        where: { claimer, expiredAt: { gt: new Date() } },
      }),
      plan.FromTask.fromTask,
      plan.map(x => x?.token ?? null),
    )()
  }

  public getReceiver(token: string) {
    return pipe(
      () => this.prismaClient.pushReceiver.findUnique({
        select: { id: true },
        where: { expiredAt: { gt: new Date() }, token },
      }),
      plan.FromTask.fromTask,
      plan.map(x => x?.id ?? null),
    )()
  }

  public getSubscriptions(receiverId: number, type: string) {
    return pipe(
      () => this.prismaClient.pushSubscription.findMany({
        select: { push: { select: { source: true } } },
        where: { push: { expiredAt: { gt: new Date() }, type }, receiverId },
      }),
      plan.FromTask.fromTask,
      plan.map(
        readonlyArray.map(x => x.push.source),
      ),
    )()
  }

  public* patchSubscriptions(receiverId: number, type: string, pushIdArray: readonly number[]) {
    if (0 === pushIdArray.length) {
      return either.right([])
    }

    const exists = yield* this.existsReceivers([receiverId])

    if (0 === exists.length) {
      return either.right([])
    }

    const invalid = yield* this.validateSubscriptions(receiverId, type, pushIdArray)

    if (0 < invalid.length) {
      return either.left(invalid)
    }

    const now = Temporal.Now.zonedDateTimeISO()
    const expiredAt = new Date(now.add(this.defaultExpire).epochMilliseconds)

    const existsPushes = yield* pipe(
      pushIdArray,
      readonlyArray.map(pushId => pipe(
        () => this.prismaClient.push.upsert({
          create: { expiredAt, source: pushId, type },
          select: { id: true, source: true },
          update: { expiredAt },
          where: { rawId: { source: pushId, type } },
        }),
        plan.FromTask.fromTask,
      )),
      plan.sequenceArray,
    )()

    return yield* this.prismaClient.$callTransaction(
      function* (this: PushService, tx: PrismaTransaction) {
        const pushesId = existsPushes.map(x => x.id)

        const newSubscriptions = yield* pipe(
          () => tx.$pushSubscription().pushesForScale(receiverId, pushesId),
          plan.map(flow(
            a => (b: typeof a) => readonlyArray.difference(number.Eq)(b, a),
            identity.ap(pushesId),
          )),
        )()

        const now = new Date()

        yield* call(
          () => tx.pushSubscription.createMany({
            data: newSubscriptions.map(pushId => ({
              createdAt: now,
              pushId,
              receiverId,
            })),
          }),
        )

        const pushRecord = Object.fromEntries(existsPushes.map(x => [x.id, x.source] as const))
        const newSources = newSubscriptions.map(x => pushRecord[x]!)
        const notification = this.redisPushService.getNotification()

        yield* notification.publish(
          notification.getChannel(receiverId),
          {
            pushes: newSources.map(source => ({ source, type })),
            type: 'subscribe',
          },
        )

        return either.right(newSources)
      }.bind(this),
    )
  }

  public* postReceiver(claimer: number | null) {
    const now = Temporal.Now.zonedDateTimeISO()
    const createdAt = new Date(now.epochMilliseconds)
    const expiredAt = new Date(now.add(this.defaultExpire).epochMilliseconds)

    return yield* call(
      () => this.prismaClient.pushReceiver.create({
        data: {
          claimer,
          createdAt,
          expiredAt,
        },
        select: { id: true, token: true },
      }),
    )
  }

  public* putClaimer(receiverId: number, claimer: number) {
    const receiver = yield* call(
      () => this.prismaClient.pushReceiver.findUnique({
        select: { claimer: true },
        where: { expiredAt: { gt: new Date() }, id: receiverId },
      }),
    )

    if (null === receiver) {
      return false
    }

    if (null !== receiver.claimer) {
      if (claimer === receiver.claimer) {
        return true
      }
      else {
        yield* this.deleteReceiver(receiverId)

        return false
      }
    }

    yield* call(
      () => this.prismaClient.pushReceiver.update({
        data: { claimer },
        where: { OR: [{ claimer }, { claimer: null }], id: receiverId },
      }),
    )

    return true
  }

  public* putReceiver(claimer: number) {
    const receiver = yield* call(
      () => this.prismaClient.pushReceiver.findUnique({
        select: { expiredAt: true, id: true, token: true },
        where: { claimer },
      }),
    )

    if (receiver) {
      if (new Date() < receiver.expiredAt) {
        return zPlus(receiverSchema).parse(receiver)
      }

      yield* call(
        () => this.prismaClient.pushReceiver.delete({
          where: { token: receiver.token },
        }),
      )
    }

    return yield* this.postReceiver(claimer)
  }

  private* deleteExpiredPushes() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      yield* call(
        () => this.prismaClient.push.deleteMany({
          where: { expiredAt: { lte: new Date() } },
        }),
      )

      yield* sleep(interval)
    }
  }

  private* deleteExpiredReceivers() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      yield* call(
        () => this.prismaClient.pushReceiver.deleteMany({
          where: { expiredAt: { lte: new Date() } },
        }),
      )

      yield* sleep(interval)
    }
  }

  private validateSubscriptions(receiverId: number, type: string, pushIdArray: readonly number[]) {
    return match(type)
      .with(
        dialogueValidator.type,
        () => dialogueValidator.validate(this.prismaClient, receiverId, pushIdArray),
      )
      .with(
        groupValidator.type,
        () => groupValidator.validate(this.prismaClient, receiverId, pushIdArray),
      )
      .otherwise(plan.Pointed.of(pushIdArray))
  }
}

const receiverSchema = z.object({
  id: z.custom<number>(),
  token: z.custom<string>(),
})
