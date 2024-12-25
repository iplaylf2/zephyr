import { Inject, Injectable } from '@nestjs/common'
import { PrismaClient, PrismaTransaction } from '../../repositories/prisma/client.js'
import { call, sleep } from 'effection'
import { either, identity, number, readonlyArray, task } from 'fp-ts'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { PushService as EntityPushService } from '../../repositories/redis/entities/push.service.js'
import { ModuleRaii } from '../../common/module-raii.js'
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
    return this.prismaClient.$callTransaction(
      function*(this: PushService, tx: PrismaTransaction) {
        const _receivers = yield * tx.$pushReceiver().forUpdate(receivers)

        yield * call(
          () => tx.pushReceiver.updateMany({
            data: {
              lastActiveAt: new Date(),
            },
            where: { id: { in: where.writable(_receivers) } },
          }),
        )

        return _receivers
      }.bind(this),
    )
  }

  public deleteReceiver(receiver: number) {
    return this.prismaClient.$callTransaction(
      function*(this: PushService, tx: PrismaTransaction) {
        yield * call(
          () => tx.pushReceiver.delete({
            select: {},
            where: { id: receiver },
          }),
        )

        const notification = this.entityPushService.getNotification()

        yield * notification.publish(notification.getChannel(receiver), { type: 'delete' })
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

    const existsPushes = yield * pipe(
      () => this.prismaClient.push.findMany({
        select: { id: true, source: true },
        where: {
          source: { in: where.writable(pushes) },
          type,
        },
      }),
      cOperation.FromTask.fromTask,
    )()

    return yield * this.prismaClient.$callTransaction(
      function*(this: PushService, tx: PrismaTransaction) {
        const toDelete = yield * tx
          .$pushSubscription()
          .pushesForScale(receiver, existsPushes.map(x => x.id))

        yield * call(
          () => tx.pushSubscription.deleteMany({
            where: { push: { in: where.writable(toDelete) }, receiver },
          }),
        )

        const pushRecord = Object.fromEntries(existsPushes.map(x => [x.id, x.source] as const))
        const deletedSources = toDelete.map(x => pushRecord[x]!)
        const notification = this.entityPushService.getNotification()

        yield * notification.publish(
          notification.getChannel(receiver),
          { push: { sources: deletedSources, type }, type: 'unsubscribe' },
        )

        return deletedSources
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
    return this.prismaClient.$callTransaction(
      function*(this: PushService, tx: PrismaTransaction) {
        const interval = `${seconds.toFixed(0)} seconds`
        const now = new Date()

        const _receivers = yield * pipe(
          receivers,
          readonlyArray.map(
            receiver => () =>
              tx.$queryRaw<Pick<PushReceiver, 'expiredAt' | 'id'>[]>`
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

  public getClaimerReceiver(claimer: number) {
    return pipe(
      () => this.prismaClient.pushReceiver.findUnique({
        select: { id: true },
        where: { claimer, expiredAt: { gt: new Date() } },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(x => x?.id ?? null),
    )()
  }

  public getClaimerReceiverToken(claimer: number) {
    return pipe(
      () => this.prismaClient.pushReceiver.findUnique({
        select: { token: true },
        where: { claimer, expiredAt: { gt: new Date() } },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(x => x?.token ?? null),
    )()
  }

  public getReceiver(token: string) {
    return pipe(
      () => this.prismaClient.pushReceiver.findUnique({
        select: { id: true },
        where: { expiredAt: { gt: new Date() }, token },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(x => x?.id ?? null),
    )()
  }

  public getSubscriptions(receiver: number, type: string) {
    return pipe(
      () => this.prismaClient.pushSubscription.findMany({
        select: { xPush: { select: { source: true } } },
        where: { receiver, xPush: { expiredAt: { gt: new Date() }, type } },
      }),
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.xPush.source),
      ),
    )()
  }

  public *patchSubscriptions(receiver: number, type: string, pushes: readonly number[]) {
    if (0 === pushes.length) {
      return either.right([])
    }

    const exists = yield * this.existsReceivers([receiver])

    if (0 === exists.length) {
      return either.right([])
    }

    const invalid = yield * this.validateSubscriptions(receiver, type, pushes)

    if (0 < invalid.length) {
      return either.left(invalid)
    }

    const now = Temporal.Now.zonedDateTimeISO()
    const expiredAt = new Date(now.add(this.defaultExpire).epochMilliseconds)

    const existsPushes = yield * pipe(
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

    return yield * this.prismaClient.$callTransaction(
      function*(this: PushService, tx: PrismaTransaction) {
        const pushesId = existsPushes.map(x => x.id)

        const newSubscriptions = yield * pipe(
          () => tx.$pushSubscription().pushesForScale(receiver, pushesId),
          cOperation.map(flow(
            a => (b: typeof a) => readonlyArray.difference(number.Eq)(b, a),
            identity.ap(pushesId),
          )),
        )()

        const now = new Date()

        yield * call(
          () => tx.pushSubscription.createMany({
            data: newSubscriptions.map(push => ({
              createdAt: now,
              push,
              receiver,
            })),
          }),
        )

        const pushRecord = Object.fromEntries(existsPushes.map(x => [x.id, x.source] as const))
        const newSources = newSubscriptions.map(x => pushRecord[x]!)
        const notification = this.entityPushService.getNotification()

        yield * notification.publish(
          notification.getChannel(receiver),
          { push: { sources: newSources, type }, type: 'unsubscribe' },
        )

        return either.right(newSources)
      }.bind(this),
    )
  }

  public postReceiver(claimer: number | null) {
    const now = Temporal.Now.zonedDateTimeISO()
    const createdAt = new Date(now.epochMilliseconds)
    const expiredAt = new Date(now.add(this.defaultExpire).epochMilliseconds)

    return call(
      () => this.prismaClient.pushReceiver.create({
        data: {
          claimer,
          createdAt,
          expiredAt,
          lastActiveAt: createdAt,
        },
        select: { id: true, token: true },
      }),
    )
  }

  public *putClaimer(receiver: number, claimer: number) {
    const _receiver = yield * call(
      () => this.prismaClient.pushReceiver.findUnique({
        select: { claimer: true },
        where: { expiredAt: { gt: new Date() }, id: receiver },
      }),
    )

    if (null === _receiver) {
      return false
    }

    if (null !== _receiver.claimer) {
      if (claimer === _receiver.claimer) {
        return true
      }
      else {
        yield * this.deleteReceiver(receiver)

        return false
      }
    }

    yield * call(
      () => this.prismaClient.pushReceiver.update({
        data: { claimer, lastActiveAt: new Date() },
        where: { OR: [{ claimer }, { claimer: null }], id: receiver },
      }),
    )

    return true
  }

  public *putReceiver(claimer: number) {
    const receiver = yield * call(
      () => this.prismaClient.pushReceiver.findUnique({
        select: { expiredAt: true, id: true, token: true },
        where: { claimer },
      }),
    )

    if (receiver) {
      if (new Date() < receiver.expiredAt) {
        return zPlus(receiverSchema).parse(receiver)
      }

      yield * call(
        () => this.prismaClient.pushReceiver.delete({
          where: { token: receiver.token },
        }),
      )
    }

    return yield * this.postReceiver(claimer)
  }

  private *deleteExpiredPushes() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      yield * call(
        () => this.prismaClient.push.deleteMany({
          where: { expiredAt: { lte: new Date() } },
        }),
      )

      yield * sleep(interval)
    }
  }

  private *deleteExpiredReceivers() {
    const interval = Temporal.Duration
      .from({ minutes: 10 })
      .total('milliseconds')

    while (true) {
      yield * call(
        () => this.prismaClient.pushReceiver.deleteMany({
          where: { expiredAt: { lte: new Date() } },
        }),
      )

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
