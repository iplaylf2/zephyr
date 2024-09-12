import { FactoryProvider, Module } from '@nestjs/common'
import { PrismaClient } from '../../generated/prisma/index.js'
import { ResourceManagerService } from '../../common/resource-manager/resource-manager.service.js'
import { call } from 'effection'
import { globalScope } from '../../kits/effection/global-scope.js'

const prismaProvider = {
  inject: [ResourceManagerService],
  provide: PrismaClient,
  useFactory(resourceManagerService: ResourceManagerService) {
    return globalScope.run(() =>
      resourceManagerService.initialize(
        function*() {
          const client = new PrismaClient()

          yield * call(client.$connect())

          return client
        },
        function*(client) {
          yield * call(client.$disconnect())
        },
      ),
    )
  },
} satisfies FactoryProvider

@Module({
  exports: [prismaProvider],
  providers: [prismaProvider],
})
export class PrismaModule {
}
