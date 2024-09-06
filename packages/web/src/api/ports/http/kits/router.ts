import { DynamicModule, Type } from '@nestjs/common'
import { RouterModule, Routes } from '@nestjs/core'
import { either, readonlyArray } from 'fp-ts'
import { flow, pipe } from 'fp-ts/lib/function.js'

export namespace router{
  export function register(routes: Routes): (DynamicModule | Type)[] {
    const modules = pipe(
      routes,
      readonlyArray.chainRecBreadthFirst(
        readonlyArray.match(
          () => [],
          readonlyArray.chain(flow(
            ({ children, module }) => [
              pipe(
                children ?? [],
                readonlyArray.partition(x => 'function' === typeof x),
                ({ left: routes, right: modules }) => [
                  either.left(routes as Routes),
                  ...modules.map(either.right),
                ],
              ),
              module ? [either.right(module)] : [],
            ],
            x => x.flat(),
          )))),
    )

    return [...modules, RouterModule.register(routes)]
  }
}
