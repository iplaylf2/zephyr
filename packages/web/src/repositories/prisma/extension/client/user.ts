import { Prisma, User } from '../../generated/index.js'
import { pipe } from 'fp-ts/lib/function.js'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { readonlyArray } from 'fp-ts'

export const user = Prisma.defineExtension({
  client: {
    $user() {
      const client = Prisma.getExtensionContext(this)

      return {
        forKey(idArray: readonly number[]) {
          if (0 === idArray.length) {
            return plan.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<User, 'id'>[]>`
              select
                id
              from 
                users
              where
                id in (${Prisma.join(idArray)})
              for key share`,
            plan.FromTask.fromTask,
            plan.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
        forQuery(idArray: readonly number[]) {
          if (0 === idArray.length) {
            return plan.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<User, 'id'>[]>`
              select
                id
              from 
                users
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
        forScale(idArray: readonly number[]) {
          if (0 === idArray.length) {
            return plan.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<User, 'id'>[]>`
              select
                id
              from 
                users
              where 
                id in (${Prisma.join(idArray)})
              for update`,
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
            () => client.$queryRaw<Pick<User, 'id'>[]>`
              select
                id
              from 
                users
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
