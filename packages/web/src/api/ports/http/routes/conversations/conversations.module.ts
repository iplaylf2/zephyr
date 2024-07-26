import { AuthModule } from '../../auth/auth.module.js'
import { ConversationsController } from './conversations.controller.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [ConversationsController],
  imports: [AuthModule],
})
export class ConversationsModule {
}
