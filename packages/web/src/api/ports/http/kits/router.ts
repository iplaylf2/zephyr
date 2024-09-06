import { DynamicModule, Type } from '@nestjs/common'
import { RouteTree, RouterModule, Routes } from '@nestjs/core'
import { either, readonlyArray } from 'fp-ts'
import { pipe } from 'fp-ts/lib/function.js'

export namespace router{
  export function register(routes: Routes): (DynamicModule | Type)[] {
    const modules = pipe(
      routes,
      readonlyArray.chain(
        readonlyArray.chainRecBreadthFirst(
          ({ children, module }) => [
            pipe(
              children ?? [],
              readonlyArray.map(
                either.fromPredicate(
                  x => 'function' === typeof x,
                  x => x as RouteTree,
                ),
              ),
            ),
            module ? [either.right(module)] : [],
          ].flat(),
        ),
      ),
    )

    return [...modules, RouterModule.register(routes)]
  }
}
