import { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Operation, Task, all } from 'effection'
import { globalScope } from '@zephyr/kit/effection/global-scope.js'

export class ModuleRaii implements OnModuleInit, OnModuleDestroy {
  protected readonly initializeCallbacks = new Array<() => Operation<any>>()

  private moduleLife: Task<any> | null = null

  public onModuleDestroy() {
    void this.moduleLife?.halt()
  }

  public onModuleInit() {
    this.moduleLife = globalScope.run(
      () => all(this.initializeCallbacks.map(cb => cb())),
    )
  }
}
