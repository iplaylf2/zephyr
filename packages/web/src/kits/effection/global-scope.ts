/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Scope } from 'effection'

export function initGlobalScope(scope: Scope) {
  if (_scope) {
    return false
  }

  _scope = scope

  return true
}

export const globalScope = new Proxy(
  {} as Scope,
  {
    get(_target, p) {
      if (null === _scope) {
        throw new Error()
      }

      return (_scope as any)[p]
    },
  },
)

let _scope: Scope | null = null
