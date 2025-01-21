import { Prisma, PushSubscription } from '../../generated/index.js'
import { cOperation } from '../../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'

export const pushSubscription = Prisma.defineExtension({
  client: {
    $pushSubscription() {
      const client = Prisma.getExtensionContext(this)

      return {
        pushesForQuery(receiverId: number, pushIdArray: readonly number[]) {
          if (0 === pushIdArray.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<PushSubscription, 'pushId'>[]>`
              select
                "pushId"
              from
                "push-subscriptions"
              where
                "receiverId" = ${receiverId} and
                "pushId" in (${Prisma.join(pushIdArray)})
              for key share`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.pushId),
            ),
          )()
        },
        pushesForQueryByReceiver(receiverId: number) {
          return pipe(
            () => client.$queryRaw<Pick<PushSubscription, 'pushId'>[]>`
              select
                "pushId"
              from
                "push-subscriptions"
              where
                "receiverId" = ${receiverId}
              for key share`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.pushId),
            ),
          )()
        },
        pushesForScale(receiverId: number, pushIdArray: readonly number[]) {
          if (0 === pushIdArray.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<PushSubscription, 'pushId'>[]>`
              select
                "pushId"
              from
                "push-subscriptions"
              where
                "receiverId" = ${receiverId} and
                "pushId" in (${Prisma.join(pushIdArray)})
              for update`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.pushId),
            ),
          )()
        },
        pushesForUpdate(receiverId: number, pushIdArray: readonly number[]) {
          if (0 === pushIdArray.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<PushSubscription, 'pushId'>[]>`
              select
                "pushId"
              from
                "push-subscriptions"
              where
                "receiverId" = ${receiverId} and
                "pushId" in (${Prisma.join(pushIdArray)})
              for no key update`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.pushId),
            ),
          )()
        },
      }
    },
  },
})
