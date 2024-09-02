import { DynamicModule, Type } from '@nestjs/common'
import { RouterModule, Routes } from '@nestjs/core'
import { array, either, readonlyArray } from 'fp-ts'
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
    readonlyArray.flatMap((route) => {
      const { left: routes, right: modules } = pipe(
        route.children ?? [],
        array.partition(x => 'function' === typeof x),
      )

      if (route.module) {
        modules.push(route.module)
      }

      return [either.left(routes as Routes), either.right(modules)]
    }),
    readonlyArray.separate,
  )

  modules.push(...childModules.flat())

  return flattenModule(childRoutes.flat(), modules)
}
