import { Operation, Scope, suspend, useScope } from 'effection'
import { Injectable } from '@nestjs/common'
import { ModuleRaii } from '../module-raii.js'

@Injectable()
export class ResourceManagerService extends ModuleRaii {
  private scope!: Scope

  public constructor() {
    super()

    this.initializeCallbacks.push(() => this.keep())
  }

  public provide<T>(provider: () => Operation<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.scope.run(function*() {
        const resource = yield * provider()

        resolve(resource)

        yield * suspend()
      }).catch(reject)
    })
  }

  private *keep() {
    this.scope = yield * useScope()

    yield * suspend()
  }
}
