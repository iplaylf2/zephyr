import { FactoryProvider, Module } from '@nestjs/common'
import { Future, Scope, suspend, useScope } from 'effection'
import { ResourceManagerService } from './resource-manager.service.js'
import { globalScope } from '@zephyr/kit/effection/global-scope.js'

@Module({
  exports: [ResourceManagerService],
  providers: [{
    provide: ResourceManagerService,
    async useFactory() {
      const [scope, destroy] = await new Promise<[Scope, () => Future<void>]>((resolve, reject) => {
        const task = globalScope.run(function* () {
          const scope = yield* useScope()

          resolve([scope, () => task.halt()])

          yield* suspend()
        })

        task.catch(reject)
      })

      return new ResourceManagerService(scope, destroy)
    },
  } satisfies FactoryProvider],
})
export class ResourceManagerModule {}
