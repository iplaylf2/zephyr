import { Prisma } from '../../../repositories/prisma/generated/index.js'
import { cOperation } from '../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'
import { subscription } from './push.js'

export const dialogueValidator = {
  type: 'dialogue' as const,
  validate(tx, receiver, pushes) {
    return pipe(
      () => tx.$queryRaw<{ id: number }[]>`
        with validated as (
        select
          unnest(array[${Prisma.join(pushes)}]) as "id"
        )
        select
          v.id
        from
          validated v
        left join dialogues d on
          d.conversation = v.id
        left join "push-receivers" pr on
          (pr.claimer = d.initiator or
          pr.claimer = d.participant) and
          ${receiver} = pr.claimer
        where
          pr is null`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  },
} satisfies subscription.Validator
