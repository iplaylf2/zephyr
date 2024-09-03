import { AuthModule } from '../../../auth/auth.module.js'
import { MemberController } from './member.controller.js'
import { Module } from '@nestjs/common'
import { conversation } from '../../../../../../domains/conversation/group/group.module.js'

@Module({
  controllers: [MemberController],
  imports: [AuthModule, conversation.GroupModule],
})
export class MemberModule {
}
