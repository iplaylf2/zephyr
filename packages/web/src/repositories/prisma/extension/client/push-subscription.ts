import { Prisma, PushSubscription } from '../../generated/index.js'
import { cOperation } from '../../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'

export const pushSubscription = Prisma.defineExtension({
  client: {
    $pushSubscription() {
      const client = Prisma.getExtensionContext(this)

      return {
        pushesForQuery(receiver: number, pushes: readonly number[]) {
          if (0 === pushes.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<PushSubscription, 'push'>[]>`
              select
                push
              from
                push-subscriptions
              where
                receiver = ${receiver} and
                push in (${Prisma.join(pushes)})
              for key share`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.push),
            ),
          )()
        },
        pushesForQueryByReceiver(receiver: number) {
          return pipe(
            () => client.$queryRaw<Pick<PushSubscription, 'push'>[]>`
              select
                push
              from
                push-subscriptions
              where
                receiver = ${receiver}
              for key share`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.push),
            ),
          )()
        },
        pushesForScale(receiver: number, pushes: readonly number[]) {
          if (0 === pushes.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<PushSubscription, 'push'>[]>`
              select
                push
              from
                push-subscriptions
              where
                receiver = ${receiver} and
                push in (${Prisma.join(pushes)})
              for update`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.push),
            ),
          )()
        },
        pushesForUpdate(receiver: number, pushes: readonly number[]) {
          if (0 === pushes.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<PushSubscription, 'push'>[]>`
              select
                push
              from
                push-subscriptions
              where
                receiver = ${receiver} and
                push in (${Prisma.join(pushes)})
              for no key update`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.push),
            ),
          )()
        },
      }
    },
  },
})
