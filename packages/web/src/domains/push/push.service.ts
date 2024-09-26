import { Inject, Injectable } from '@nestjs/common'
import { PushService as EntityPushService } from '../../repositories/redis/entities/push.service.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { PrismaClient } from '../../repositories/prisma/generated/index.js'
import { Temporal } from 'temporal-polyfill'
import { call } from 'effection'

@Injectable()
export class PushService extends ModuleRaii {
  @Inject()
  private readonly entityPushService!: EntityPushService

  @Inject()
  private readonly prismaClient!: PrismaClient

  public readonly defaultExpire = Temporal.Duration.from({ days: 1 })

  public constructor() {
    super()

    void this.entityPushService
    // this.initializeCallbacks.push(() => this.expireReceiversEfficiently())
    // this.initializeCallbacks.push(() => this.expireSubscriptionsEfficiently())
    // this.initializeCallbacks.push(() => this.deleteExpiredReceivers())
    // this.initializeCallbacks.push(() => this.deleteExpiredSubscriptions())
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
      select: { id: true, token: true },
      where: { claimer },
    }))

    if (receiver) {
      return receiver
    }

    return yield * this.postReceiver(claimer)
  }
}
