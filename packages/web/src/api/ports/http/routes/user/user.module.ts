import { AuthModule } from '../../auth/auth.module.js'
import { UserModule as DomainUserModule } from '../../../../../domains/user/user.module.js'
import { Module } from '@nestjs/common'
import { UserController } from './user.controller.js'

@Module({
  controllers: [UserController],
  imports: [DomainUserModule, AuthModule],
})
export class UserModule {}
