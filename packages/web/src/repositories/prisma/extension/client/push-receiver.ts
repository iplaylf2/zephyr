import { Prisma, PushReceiver } from '../../generated/index.js'
import { pipe } from 'fp-ts/lib/function.js'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { readonlyArray } from 'fp-ts'

export const pushReceiver = Prisma.defineExtension({
  client: {
    $pushReceiver() {
      const client = Prisma.getExtensionContext(this)

      return {
        forQuery(idArray: readonly number[]) {
          if (0 === idArray.length) {
            return plan.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<PushReceiver, 'id'>[]>`
              select
                id
              from 
                "push-receivers"
              where 
                ${Date.now()} < "expiredAt" and
                id in (${Prisma.join(idArray)})
              for key share`,
            plan.FromTask.fromTask,
            plan.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
        forUpdate(idArray: readonly number[]) {
          if (0 === idArray.length) {
            return plan.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<PushReceiver, 'id'>[]>`
              select
                id
              from 
                "push-receivers"
              where 
                ${Date.now()} < "expiredAt" and
                id in (${Prisma.join(idArray)})
              for no key update`,
            plan.FromTask.fromTask,
            plan.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
      }
    },
  },
})
