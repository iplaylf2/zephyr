import { SQL, sql } from 'drizzle-orm'
import { identity, readonlyArray } from 'fp-ts'
import { StringKeyOf } from 'type-fest'
import { arrayPlus } from '@zephyr/kit/array-plus.js'
import { objectPlus } from '@zephyr/kit/object-plus.js'
import { pipe } from 'fp-ts/lib/function.js'

export namespace magicSql{
  export function valuesLists<T extends Readonly<Record<string, any>>>(
    lists: readonly T[],
    keys: Array<StringKeyOf<T>>,
    alias: string,
  ): [vlSql: SQL, vl: Readonly<Record<StringKeyOf<T>, SQL>>] {
    return [
      pipe(
        lists,
        readonlyArray.map(
          item => pipe(
            keys,
            readonlyArray.map(
              key => sql`${item[key]}`,
            ),
            items => sql.join(arrayPlus.writable(items), ','),
            itemsSql => sql.join([sql`(`, itemsSql, sql`)`]),
          ),
        ),
        values => sql.join(arrayPlus.writable(values), ','),
        valuesSql => (keysSql: SQL) => sql.join([
          sql`(VALUES`,
          valuesSql,
          sql`) as ${sql.raw(alias)}(`,
          keysSql,
          sql`)`,
        ]),
        identity.ap(
          pipe(
            keys,
            readonlyArray.map(key => sql.raw(key as string)),
            keys => sql.join(arrayPlus.writable(keys), ','),
          ),
        ),
      ),
      pipe(
        keys,
        readonlyArray.map(
          key => [key, sql.raw(`${alias}.${key as string}`)] as const,
        ),
        objectPlus.fromEntries,
      ),
    ]
  }
}
