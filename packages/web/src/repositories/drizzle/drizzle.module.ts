import { Module } from '@nestjs/common'
import { ResourceManagerModule } from '../../common/resource-manager/resource-manager.module.js'
import { drizzleProvider } from './drizzle.service.js'

@Module({
  exports: [drizzleProvider],
  imports: [ResourceManagerModule],
  providers: [drizzleProvider],
})
export class DrizzleModule {}
