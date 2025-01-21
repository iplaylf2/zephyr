import { TypeController, typePath } from './type.controller.js'
import { AuthModule } from '../../../../../../auth/auth.module.js'
import { Module } from '@nestjs/common'
import { PushModule } from '../../../../../../../../../domains/push/push.module.js'

@Module({
  controllers: [TypeController],
  imports: [AuthModule, PushModule],
  providers: [typePath.provider],
})
export class TypeModule {}
