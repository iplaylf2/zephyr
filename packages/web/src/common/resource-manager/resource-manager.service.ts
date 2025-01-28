import { Future, Operation, Scope, suspend } from 'effection'
import { Injectable } from '@nestjs/common'
import { ModuleRaii } from '../module-raii.js'

@Injectable()
export class ResourceManagerService extends ModuleRaii {
  public constructor(private readonly scope: Scope, private readonly destroy: () => Future<void>) {
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
    try {
      yield * suspend()
    }
    finally {
      yield * this.destroy()
    }
  }
}
