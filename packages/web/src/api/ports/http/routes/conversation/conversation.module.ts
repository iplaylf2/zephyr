import { AuthModule } from '../../auth/auth.module.js'
import { ConversationController } from './conversation.controller.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [ConversationController],
  imports: [AuthModule],
})
export class ConversationModule {
}
