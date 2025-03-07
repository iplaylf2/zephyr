import { ConversationXParticipant, Prisma } from '../../generated/index.js'
import { pipe } from 'fp-ts/lib/function.js'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { readonlyArray } from 'fp-ts'

export const conversationXParticipant = Prisma.defineExtension({
  client: {
    $conversationXParticipant() {
      const client = Prisma.getExtensionContext(this)

      return {
        participantsForQuery(type: string, conversationId: number, participantIdArray: readonly number[]) {
          if (0 === participantIdArray.length) {
            return plan.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<ConversationXParticipant, 'participantId'>[]>`
              select
                x."participantId"
              from
                "conversation-x-participant" x
              join conversations on
                conversations.id = x."conversationId"
              where
                ${new Date()} < conversations."expiredAt" and
                conversations.type = ${type} and
                x."conversationId" = ${conversationId} and
                x."participantId" in (${Prisma.join(participantIdArray)})
              for key share`,
            plan.FromTask.fromTask,
            plan.map(
              readonlyArray.map(x => x.participantId),
            ),
          )()
        },
        participantsForScale(type: string, conversationId: number, participantIdArray: readonly number[]) {
          if (0 === participantIdArray.length) {
            return plan.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<ConversationXParticipant, 'participantId'>[]>`
              select
                x."participantId"
              from
                "conversation-x-participant" x
              join conversations on
                conversations.id = x."conversationId"
              where
                conversations.type = ${type} and
                x."conversationId" = ${conversationId} and
                x."participantId" in (${Prisma.join(participantIdArray)})
              for update`,
            plan.FromTask.fromTask,
            plan.map(
              readonlyArray.map(x => x.participantId),
            ),

          )()
        },
        participantsForUpdate(type: string, conversationId: number, participantIdArray: readonly number[]) {
          if (0 === participantIdArray.length) {
            return plan.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<ConversationXParticipant, 'participantId'>[]>`
              select
                x."participantId"
              from
                "conversation-x-participant" x
              join conversations on
                conversations.id = x."conversationId"
              where
                ${new Date()} < conversations."expiredAt" and
                conversations.type = ${type} and
                x."conversationId" = ${conversationId} and
                x.participant in (${Prisma.join(participantIdArray)})
              for no key update`,
            plan.FromTask.fromTask,
            plan.map(
              readonlyArray.map(x => x.participantId),
            ),
          )()
        },
      }
    },
  },
})
