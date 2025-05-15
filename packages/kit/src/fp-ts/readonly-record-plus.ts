/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { RequiredKeysOf, SetFieldType, Simplify } from 'type-fest'
import { option, readonlyArray, readonlyRecord } from 'fp-ts'
import { flow } from 'fp-ts/lib/function.js'

export namespace readonlyRecordPlus{
  export function modifyAt<A extends Readonly<Record<any, any>>, K extends RequiredKeysOf<A>, V>(
    k: K,
    f: (a: A[K]) => V,
  ): (a: A) => SetFieldType<A, K, V> {
    return flow(
      readonlyRecord.modifyAt(k as string, f as any),
      option.toUndefined,
    ) as any
  }

  export function upsertAt<A extends Readonly<Record<any, any>>, K extends string, V>(
    k: K,
    v: V,
  ): (a: A) => Simplify<Omit<A, K> & { [k in K]: V }> {
    return readonlyRecord.upsertAt(k, v) as any
  }

  export function omit<A extends Readonly<Record<any, any>>, KS extends (keyof A)[]>(
    ks: KS,
  ): (a: A) => Omit<A, KS[number]> {
    const kss = new Set(ks)

    return flow(
      readonlyRecord.toEntries,
      readonlyArray.filter(([k]) => !kss.has(k)),
      readonlyRecord.fromEntries,
    ) as any
  }

  export function pick<A extends Readonly<Record<any, any>>, KS extends Array<keyof A>>(
    ks: KS,
  ): (a: A) => Pick<A, KS[number]> {
    const kss = new Set(ks)

    return flow(
      readonlyRecord.toEntries,
      readonlyArray.filter(([k]) => kss.has(k)),
      readonlyRecord.fromEntries,
    ) as any
  }
}
