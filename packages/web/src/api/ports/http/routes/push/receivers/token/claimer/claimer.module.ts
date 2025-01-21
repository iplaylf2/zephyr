import { AuthModule } from '../../../../../auth/auth.module.js'
import { ClaimerController } from './claimer.controller.js'
import { Module } from '@nestjs/common'
import { PushModule } from '../../../../../../../../domains/push/push.module.js'
import { path } from '../../../../../pattern.js'

@Module({
  controllers: [ClaimerController],
  imports: [AuthModule, PushModule],
  providers: [path.token.provider],
})
export class ClaimerModule {}
