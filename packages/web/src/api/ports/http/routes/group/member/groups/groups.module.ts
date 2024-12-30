import { AuthModule } from '../../../../auth/auth.module.js'
import { GroupsController } from './groups.controller.js'
import { Module } from '@nestjs/common'
import { conversation } from '../../../../../../../domains/conversation/conversation.js'

@Module({
  controllers: [GroupsController],
  imports: [AuthModule, conversation.GroupModule],
})
export class GroupsModule {}
