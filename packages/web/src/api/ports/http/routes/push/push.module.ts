import { Module } from '@nestjs/common'
import { PushController } from './push.controller.js'

@Module({
  controllers: [PushController],
})
export class PushModule {}
