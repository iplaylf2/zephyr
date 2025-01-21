import { AuthModule } from '../../../../auth/auth.module.js'
import { Module } from '@nestjs/common'
import { PushModule } from '../../../../../../../domains/push/push.module.js'
import { ReceiverController } from './receiver.controller.js'

@Module({
  controllers: [ReceiverController],
  imports: [AuthModule, PushModule],
})
export class ReceiverModule {}
