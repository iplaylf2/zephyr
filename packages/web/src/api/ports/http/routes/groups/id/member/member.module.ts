import { AuthModule } from '../../../../auth/auth.module.js'
import { MemberController } from './member.controller.js'
import { Module } from '@nestjs/common'
import { UserModule } from '../../../../../../../domains/user/user.module.js'
import { conversation } from '../../../../../../../domains/conversation/conversation.js'
import { path } from '../../../../pattern.js'

@Module({
  controllers: [MemberController],
  imports: [AuthModule, UserModule, conversation.GroupModule],
  providers: [path.group.provider],
})
export class MemberModule {}
