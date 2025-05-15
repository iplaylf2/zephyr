import { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Task, all } from 'effection'
import { Plan } from '@zephyr/kit/effection/operation.js'
import { globalScope } from '@zephyr/kit/effection/global-scope.js'

export class ModuleRaii implements OnModuleInit, OnModuleDestroy {
  protected readonly initializePlans = new Array<Plan<void>>()

  private moduleLife: Task<any> | null = null

  public onModuleDestroy() {
    void this.moduleLife?.halt()
  }

  public onModuleInit() {
    this.moduleLife = globalScope.run(
      () => all(this.initializePlans.map(plan => plan())),
    )
  }
}
