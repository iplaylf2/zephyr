import { Dialogue, Prisma } from '../../generated/index.js'
import { pipe } from 'fp-ts/lib/function.js'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { readonlyArray } from 'fp-ts'

export const dialogue = Prisma.defineExtension({
  client: {
    $dialogue() {
      const client = Prisma.getExtensionContext(this)

      return {
        forQuery(participantId: number) {
          return pipe(
            () => client.$queryRaw<Pick<Dialogue, 'conversationId'>[]>`
              select
                "conversationId"
              from 
                dialogues
              where
                ${new Date()} < "expiredAt" and
                ( "initiatorId" = ${participantId} or
                  "participantId" = ${participantId} )
              for key share`,
            plan.FromTask.fromTask,
            plan.map(
              readonlyArray.map(x => x.conversationId),
            ),
          )()
        },
        forUpdate(participantId: number) {
          return pipe(
            () => client.$queryRaw<Pick<Dialogue, 'conversationId'>[]>`
              select
                "conversationId"
              from 
                dialogues
              where
                ${new Date()} < "expiredAt" and
                ( "initiatorId" = ${participantId} or
                  "participantId" = ${participantId} )
              for no key update`,
            plan.FromTask.fromTask,
            plan.map(
              readonlyArray.map(x => x.conversationId),
            ),
          )()
        },
      }
    },
  },
})
