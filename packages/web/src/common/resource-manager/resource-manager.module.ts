import { Module } from '@nestjs/common'
import { ResourceManagerService } from './resource-manager.service.js'

@Module({
  exports: [ResourceManagerService],
  providers: [ResourceManagerService],
})
export class ResourceManagerModule {}
