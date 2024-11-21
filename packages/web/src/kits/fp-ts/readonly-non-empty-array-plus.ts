import { eq, readonlyArray, readonlyMap, readonlyNonEmptyArray } from 'fp-ts'
import { flow } from 'fp-ts/lib/function.js'

export namespace readonlyNonEmptyArrayPlus{
  export function groupBy<A, K>(f: (a: A) => K):
  (as: ReadonlyArray<A>) =>
  ReadonlyMap<K, readonlyNonEmptyArray.ReadonlyNonEmptyArray<A>> {
    const readonlyMapFold = readonlyMap.fromFoldable(
      eq.eqStrict as eq.Eq<K>,
      readonlyNonEmptyArray.getSemigroup<A>(),
      readonlyArray.Foldable,
    )

    return flow(
      readonlyArray.map(
        a => [f(a), readonlyNonEmptyArray.of(a)] as const,
      ),
      readonlyMapFold,
    )
  }
}
