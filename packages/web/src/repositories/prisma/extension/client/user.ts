import { Prisma, User } from '../../generated/index.js'
import { cOperation } from '../../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'

export const user = Prisma.defineExtension({
  client: {
    $user() {
      const client = Prisma.getExtensionContext(this)

      return {
        forDelete(users: readonly number[]) {
          if (0 === users.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<User, 'id'>[]>`
                select
                  id
                from 
                  users
                where 
                  id in ${Prisma.join(users)}
                for update`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
        forKey(users: readonly number[]) {
          if (0 === users.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<User, 'id'>[]>`
              select
                id
              from 
                users
              where
                id in ${Prisma.join(users)}
              for key share`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
        forQuery(users: readonly number[]) {
          if (0 === users.length) {
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
                id in ${Prisma.join(users)}
              for key share`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
        forUpdate(users: readonly number[]) {
          if (0 === users.length) {
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
                id in ${Prisma.join(users)}
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
