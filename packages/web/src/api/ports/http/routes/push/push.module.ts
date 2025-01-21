import { Module } from '@nestjs/common'
import { PushController } from './push.controller.js'
import { PushModule as PushModuleX } from '../../../../../domains/push/push.module.js'

@Module({
  controllers: [PushController],
  imports: [PushModuleX],
})
export class PushModule {}
