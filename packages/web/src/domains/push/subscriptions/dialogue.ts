import { Prisma } from '../../../repositories/prisma/generated/index.js'
import { cOperation } from '../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'
import { subscription } from './subscription.js'

export const dialogueValidator = {
  type: 'dialogue' as const,
  validate(tx, receiverId, pushIdArray) {
    return pipe(
      () => tx.$queryRaw<{ id: number }[]>`
        with validated as (
        select
          unnest(array[${Prisma.join(pushIdArray)}]) as "id"
        )
        select
          v.id
        from
          validated v
        left join dialogues d on
          d."conversationId" = v.id
        left join "push-receivers" pr on
          (pr.claimer = d."initiatorId" or
          pr.claimer = d."participantId") and
          pr.claimer = ${receiverId}
        where
          pr is null`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  },
} satisfies subscription.Validator
