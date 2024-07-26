import { AuthModule } from '../../../../auth/auth.module.js'
import { Module } from '@nestjs/common'
import { UserController } from './user.controller.js'
import { path } from '../../../../pattern.js'

@Module({
  controllers: [UserController],
  imports: [AuthModule],
  providers: [path.receiver.provider],
})
export class UserModule {
}
