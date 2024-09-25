import { AuthModule } from '../../../../auth/auth.module.js'
import { Module } from '@nestjs/common'
import { ReceiverController } from './receiver.controller.js'

@Module({
  controllers: [ReceiverController],
  imports: [AuthModule],
})
export class ReceiverModule {}
