import { Operation, Scope } from 'effection'

export function initGlobalScope(scope: Scope) {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition
  if (globalScope) {
    return false
  }

  globalScope = scope

  return true
}

export let globalScope!: Scope

export function unsafeGlobalScopeRun<T>(operation: () => Operation<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    globalScope.run(function* () {
      try {
        resolve(yield* operation())
      }
      catch (e) {
        reject(e as Error)
      }
    }).catch((e: unknown) => { reject(e as Error) })
  })
}
