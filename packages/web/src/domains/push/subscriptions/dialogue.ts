import { Prisma } from '../../../repositories/prisma/generated/index.js'
import { pipe } from 'fp-ts/lib/function.js'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
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
      plan.FromTask.fromTask,
      plan.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  },
} satisfies subscription.Validator
