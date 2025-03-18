import { AuthModule } from '../../auth/auth.module.js'
import { DialogueController } from './dialogue.controller.js'
import {
  DialogueModule as DomainDialogueModule,
} from '../../../../../domains/conversation/domains/dialogue/dialogue.module.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [DialogueController],
  imports: [AuthModule, DomainDialogueModule],
})
export class DialogueModule {}
