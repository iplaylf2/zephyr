import { AuthModule } from '../../../../auth/auth.module.js'
import { GroupModule } from '../../../../../../../domains/conversation/domains/group/group.module.js'
import { MemberController } from './member.controller.js'
import { Module } from '@nestjs/common'
import { UserModule } from '../../../../../../../domains/user/user.module.js'
import { path } from '../../../../pattern.js'

@Module({
  controllers: [MemberController],
  imports: [AuthModule, UserModule, GroupModule],
  providers: [path.group.provider],
})
export class MemberModule {}
