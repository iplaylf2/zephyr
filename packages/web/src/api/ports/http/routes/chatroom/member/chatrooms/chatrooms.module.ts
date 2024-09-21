import { AuthModule } from '../../../../auth/auth.module.js'
import { ChatroomsController } from './chatrooms.controller.js'
import { Module } from '@nestjs/common'
import { conversation } from '../../../../../../../domains/conversation/group/group.module.js'

@Module({
  controllers: [ChatroomsController],
  imports: [AuthModule, conversation.GroupModule],
})
export class ChatroomsModule {}
