import { SQL, Table, getTableColumns, sql } from 'drizzle-orm'
import { pipe } from 'fp-ts/lib/function.js'
import { readonlyRecordPlus } from '@zephyr/kit/fp-ts/readonly-record-plus.js'

export namespace selectedField{
  export function qualify(context: 'excluded' | 'new' | 'old', column: { name: string }): SQL {
    return sql.raw(`${context}.${column.name}`)
  }

  export function omit<T extends Table, const Keys extends Array<keyof(ColumnOf<T>)>>(table: T, keys: Keys) {
    return pipe(
      getTableColumns(table),
      readonlyRecordPlus.omit(keys),
    )
  }

  export type ColumnOf<T extends Table> = T['_']['columns']

}
