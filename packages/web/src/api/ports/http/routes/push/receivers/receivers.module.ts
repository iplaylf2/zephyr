import { ReceiversController, tokenPath } from './receivers.controller.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [ReceiversController],
  providers: [tokenPath.provider],
})
export class ReceiversModule {}
