import { Prisma, User } from '../../generated/index.js'
import { cOperation } from '../../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'

export const user = Prisma.defineExtension({
  client: {
    $user() {
      const client = Prisma.getExtensionContext(this)

      return {
        forKey(idArray: readonly number[]) {
          if (0 === idArray.length) {
            return cOperation.Pointed.of([])()
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
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
        forQuery(idArray: readonly number[]) {
          if (0 === idArray.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<User, 'id'>[]>`
              select
                id
              from 
                users
              where 
                ${Date.now()} < expiredAt and
                id in (${Prisma.join(idArray)})
              for key share`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
        forScale(idArray: readonly number[]) {
          if (0 === idArray.length) {
            return cOperation.Pointed.of([])()
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
            () => client.$queryRaw<Pick<User, 'id'>[]>`
              select
                id
              from 
                users
              where 
                ${Date.now()} < expiredAt and
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
