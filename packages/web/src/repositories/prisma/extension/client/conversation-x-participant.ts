import { ConversationXParticipant, Prisma } from '../../generated/index.js'
import { cOperation } from '../../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'

export const conversationXParticipant = Prisma.defineExtension({
  client: {
    $conversationXParticipant() {
      const client = Prisma.getExtensionContext(this)

      return {
        forQuery(type: string, conversation: number, participants: readonly number[]) {
          if (0 === participants.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<ConversationXParticipant, 'participant'>[]>`
              select
                x.participant
              from
                "conversation-x-participant" x
              join conversations on
                conversations.id = x.conversation
              where
                ${new Date()} < conversations."expiredAt" and
                conversations.type = ${type} and
                x.conversation = ${conversation} and
                x.participant in (${Prisma.join(participants)})
              for key share`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.participant),
            ),
          )()
        },
        forScale(type: string, conversation: number, participants: readonly number[]) {
          if (0 === participants.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<ConversationXParticipant, 'participant'>[]>`
              select
                x.participant
              from
                "conversation-x-participant" x
              join conversations on
                conversations.id = x.conversation
              where
                conversations.type = ${type} and
                x.conversation = ${conversation} and
                x.participant in (${Prisma.join(participants)})
              for update`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.participant),
            ),

          )()
        },
        forUpdate(type: string, conversation: number, participants: readonly number[]) {
          if (0 === participants.length) {
            return cOperation.Pointed.of([])()
          }

          return pipe(
            () => client.$queryRaw<Pick<ConversationXParticipant, 'participant'>[]>`
              select
                x.participant
              from
                "conversation-x-participant" x
              join conversations on
                conversations.id = x.conversation
              where
                ${new Date()} < conversations."expiredAt" and
                conversations.type = ${type} and
                x.conversation = ${conversation} and
                x.participant in (${Prisma.join(participants)})
              for no key update`,
            cOperation.FromTask.fromTask,
            cOperation.map(
              readonlyArray.map(x => x.participant),
            ),
          )()
        },
      }
    },
  },
})
