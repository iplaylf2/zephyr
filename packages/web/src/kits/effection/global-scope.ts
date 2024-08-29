import { Scope } from 'effection'

export function initGlobalScope(scope: Scope) {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition
  if (globalScope) {
    return false
  }

  globalScope = scope

  return true
}

export let globalScope!: Scope
