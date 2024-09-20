import { AuthModule } from '../../auth/auth.module.js'
import { DialogueController } from './dialogue.controller.js'
import { Module } from '@nestjs/common'
import { conversation } from '../../../../../domains/conversation/pair/pair.module.js'

@Module({
  controllers: [DialogueController],
  imports: [AuthModule, conversation.PairModule],
})
export class DialogueModule {
}
