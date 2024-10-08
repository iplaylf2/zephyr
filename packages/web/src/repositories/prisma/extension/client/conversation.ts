import { Conversation, Prisma } from '../../generated/index.js'
import { cOperation } from '../../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'

export const conversation = Prisma.defineExtension({
  client: {
    $conversation() {
      const client = Prisma.getExtensionContext(this)

      return {
        forQuery(type: string, conversations: readonly number[]) {
          if (0 === conversations.length) {
            return cOperation.Pointed.of([])()
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
                id in ${Prisma.join(conversations)}
              for key share`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.id),
            ),
          )()
        },
        forUpdate(type: string, conversations: readonly number[]) {
          if (0 === conversations.length) {
            return cOperation.Pointed.of([])()
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
                id in ${Prisma.join(conversations)}
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
