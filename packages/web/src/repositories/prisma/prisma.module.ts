import { Module } from '@nestjs/common'
import { ResourceManagerModule } from '../../common/resource-manager/resource-manager.module.js'
import { prismaProvider } from './client.js'

@Module({
  exports: [prismaProvider],
  imports: [ResourceManagerModule],
  providers: [prismaProvider],
})
export class PrismaModule {}
