import { Dialogue, Prisma } from '../../generated/index.js'
import { cOperation } from '../../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'

export const dialogue = Prisma.defineExtension({
  client: {
    $dialogue() {
      const client = Prisma.getExtensionContext(this)

      return {
        forQuery(participant: number) {
          return pipe(
            () => client.$queryRaw<Pick<Dialogue, 'conversation'>[]>`
              select
                conversation
              from 
                dialogues
              where
                ${new Date()} < "expiredAt" and
                ( initiator = ${participant} or
                  participant = ${participant} )
              for key share`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.conversation),
            ),
          )()
        },
        forUpdate(participant: number) {
          return pipe(
            () => client.$queryRaw<Pick<Dialogue, 'conversation'>[]>`
              select
                conversation
              from 
                dialogues
              where
                ${new Date()} < "expiredAt" and
                ( initiator = ${participant} or
                  participant = ${participant} )
              for no key update`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.conversation),
            ),
          )()
        },
      }
    },
  },
})
