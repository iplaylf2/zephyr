import { FactoryProvider, Module } from '@nestjs/common'
import { PrismaClient } from '../../generated/prisma/index.js'
import { ResourceManagerModule } from '../../common/resource-manager/resource-manager.module.js'
import { ResourceManagerService } from '../../common/resource-manager/resource-manager.service.js'
import { call } from 'effection'
import { env } from '../../env.js'
import { globalScope } from '../../kits/effection/global-scope.js'

const prismaProvider = {
  inject: [ResourceManagerService],
  provide: PrismaClient,
  useFactory(resourceManagerService: ResourceManagerService) {
    return globalScope.run(() =>
      resourceManagerService.initialize(
        function*() {
          const client = new PrismaClient({ datasourceUrl: env.prisma.datasourceUrl })

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
  imports: [ResourceManagerModule],
  providers: [prismaProvider],
})
export class PrismaModule {}
