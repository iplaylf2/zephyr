import { Prisma, PushReceiver } from '../../generated/index.js'
import { cOperation } from '@zephyr/kit/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'

export const pushReceiver = Prisma.defineExtension({
  client: {
    $pushReceiver() {
      const client = Prisma.getExtensionContext(this)

      return {
        forQuery(idArray: readonly number[]) {
          if (0 === idArray.length) {
            return cOperation.Pointed.of([])()
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
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
        forUpdate(idArray: readonly number[]) {
          if (0 === idArray.length) {
            return cOperation.Pointed.of([])()
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
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
      }
    },
  },
})
