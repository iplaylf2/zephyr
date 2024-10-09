import { Prisma } from '../../../repositories/prisma/generated/index.js'
import { cOperation } from '../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyArray } from 'fp-ts'
import { subscription } from './push.js'

export const groupValidator = {
  type: 'group' as const,
  validate(tx, _receiver, pushes) {
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
        left join conversations c on
          c.id = v.id and
          'group' = c."type"
        where
          c is null`,
      cOperation.FromTask.fromTask,
      cOperation.map(
        readonlyArray.map(x => x.id),
      ),
    )()
  },
} satisfies subscription.Validator
