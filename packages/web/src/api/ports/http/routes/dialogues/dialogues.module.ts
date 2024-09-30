import { AuthModule } from '../../auth/auth.module.js'
import { DialoguesController } from './dialogues.controller.js'
import { Module } from '@nestjs/common'
import { conversation } from '../../../../../domains/conversation/dialogue/dialogue.module.js'

@Module({
  controllers: [DialoguesController],
  imports: [AuthModule, conversation.DialogueModule],
})
export class DialoguesModule {}
