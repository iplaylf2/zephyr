import { Conversation, Prisma } from '../../generated/index.js'
import { pipe } from 'fp-ts/lib/function.js'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { readonlyArray } from 'fp-ts'

export const conversation = Prisma.defineExtension({
  client: {
    $conversation() {
      const client = Prisma.getExtensionContext(this)

      return {
        forQuery(type: string, idArray: readonly number[]) {
          if (0 === idArray.length) {
            return plan.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<Conversation, 'id'>[]>`
              select
                id
              from 
                conversations
              where
                type = ${type} and
                ${new Date()} < "expiredAt" and
                id in (${Prisma.join(idArray)})
              for key share`,
            plan.FromTask.fromTask,
            plan.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
        forUpdate(type: string, idArray: readonly number[]) {
          if (0 === idArray.length) {
            return plan.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<Conversation, 'id'>[]>`
              select
                id
              from 
                conversations
              where
                type = ${type} and
                ${new Date()} < "expiredAt" and
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
