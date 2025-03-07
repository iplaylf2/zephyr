import { Prisma } from '../../../repositories/prisma/generated/index.js'
import { pipe } from 'fp-ts/lib/function.js'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { readonlyArray } from 'fp-ts'
import { subscription } from './subscription.js'

export const groupValidator = {
  type: 'group' as const,
  validate(tx, _receiverId, pushIdArray) {
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
        left join conversations c on
          c.id = v.id and
          c."type" = 'group'
        where
          c is null`,
      plan.FromTask.fromTask,
      plan.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  },
} satisfies subscription.Validator
