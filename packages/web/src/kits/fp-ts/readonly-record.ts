/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { RequiredKeysOf, SetFieldType } from 'type-fest'
import { option, readonlyRecord } from 'fp-ts'
import { ReadonlyRecord } from 'fp-ts/lib/ReadonlyRecord.js'
import { flow } from 'fp-ts/lib/function.js'

export namespace readonlyRecordPlus{
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  export function modifyAt<A, S extends ReadonlyRecord<any, any>, K extends RequiredKeysOf<S>>(
    k: K,
    f: (a: S[K]) => A,
  ): (r: S) => SetFieldType<S, K, A> {
    return flow(
      readonlyRecord.modifyAt(k as string, f as any),
      option.toUndefined,
    ) as any
  }

  export function lookup<S extends ReadonlyRecord<any, any>, K extends RequiredKeysOf<S>>(k: K): (r: S) => S[K] {
    return flow(
      readonlyRecord.lookup(k as string),
      option.toUndefined,
    ) as any
  }
}
