import { option, readonlyNonEmptyArray } from 'fp-ts'
import { flow } from 'fp-ts/lib/function'

export namespace readonlyArrayPlus{
  export function mapCons<A, B>(headMap: (head: A) => B, tailMap: (a: A) => B): (arr: readonly A[]) => readonly B[] {
    return flow(
      option.fromPredicate((x): x is readonlyNonEmptyArray.ReadonlyNonEmptyArray<A> => 0 < x.length),
      option.map(
        ([head, ...tail]) => [headMap(head), ...tail.map(tailMap)],
      ),
      option.getOrElse(() => [] as readonly B[]),
    )
  }
}
