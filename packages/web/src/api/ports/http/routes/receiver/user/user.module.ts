import { AuthModule } from '../../../auth/auth.module.js'
import { Module } from '@nestjs/common'
import { UserController } from './user.controller.js'

@Module({
  controllers: [UserController],
  imports: [AuthModule],
})
export class UserModule {}
