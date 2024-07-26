import { Operation, all, suspend } from 'effection'
import { Injectable } from '@nestjs/common'
import { ModuleRaii } from '../module-raii.js'

@Injectable()
export class ResourceManagerService extends ModuleRaii {
  private readonly disposes = new Array<() => Operation<void>>()

  public constructor() {
    super()

    this.initializeCallback.push(() => this.prepareDestroy())
  }

  public * initialize<T>(init: () => Operation<T>, dispose: (resource: T) => Operation<void>): Operation<T> {
    const resource = yield * init()

    this.disposes.push(() => dispose(resource))

    return resource
  }

  private *prepareDestroy() {
    try {
      yield * suspend()
    }
    finally {
      yield * all(this.disposes.map(dispose => dispose()))
    }
  }
}
