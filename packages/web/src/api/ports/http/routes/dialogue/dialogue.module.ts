import { AuthModule } from '../../auth/auth.module.js'
import { DialogueController } from './dialogue.controller.js'
import { Module } from '@nestjs/common'
import { conversation } from '../../../../../domains/conversation/dialogue/dialogue.module.js'

@Module({
  controllers: [DialogueController],
  imports: [AuthModule, conversation.DialogueModule],
})
export class DialogueModule {
}
