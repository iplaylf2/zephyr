import { Module } from '@nestjs/common'
import { UserModule } from '../../../../../domains/user/user.module.js'
import { UsersController } from './users.controller.js'

@Module({
  controllers: [UsersController],
  imports: [UserModule],
})
export class UsersModule {}
