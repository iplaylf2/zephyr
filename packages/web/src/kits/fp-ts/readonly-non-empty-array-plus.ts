import { constant, flow, pipe } from 'fp-ts/lib/function.js'
import { io, option, readonlyArray, readonlyNonEmptyArray } from 'fp-ts'
import { unsafeCoerce } from '../../utils/identity.js'

export namespace readonlyNonEmptyArrayPlus{
  export function groupBy<A, K>(f: (a: A) => K):
  (as: ReadonlyArray<A>) =>
  ReadonlyMap<K, readonlyNonEmptyArray.ReadonlyNonEmptyArray<A>> {
    return flow(
      readonlyArray.reduce(
        new Map<K, A[]>(),
        (map, a) => pipe(
          f(a),
          key => pipe(
            () => map.get(key),
            io.chain(flow(
              option.fromNullable,
              option.fold(
                () => pipe(
                  () => [],
                  io.tap(x => () => map.set(key, x)),
                ),
                io.of,
              ),
            )),
          ),
          io.tap(x => () => x.push(a)),
          io.map(constant(map)),
        )(),
      ),
      unsafeCoerce<ReadonlyMap<any, any>>(),
    )
  }
}
