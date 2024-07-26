import { DynamicModule, Type } from '@nestjs/common'
import { RouterModule, Routes } from '@nestjs/core'
import { flatMap, partition, separate } from 'fp-ts/lib/Array.js'
import { left, right } from 'fp-ts/lib/Either.js'
import { pipe } from 'fp-ts/lib/function.js'

export namespace router{
  export function register(routes: Routes): (DynamicModule | Type)[] {
    return [...flattenModule(routes, []), RouterModule.register(routes)]
  }
}

function flattenModule(routes: Routes, modules: Type[]): Type[] {
  if (0 === routes.length) {
    return modules
  }

  const { left: childRoutes, right: childModules } = pipe(
    routes,
    flatMap((route) => {
      const { left: routes, right: modules } = pipe(
        route.children ?? [],
        partition(x => 'function' === typeof x),
      )

      if (route.module) {
        modules.push(route.module)
      }

      return [left(routes as Routes), right(modules)]
    }),
    separate)

  modules.push(...childModules.flat())

  return flattenModule(childRoutes.flat(), modules)
}
