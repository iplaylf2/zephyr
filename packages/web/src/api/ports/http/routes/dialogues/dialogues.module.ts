import { AuthModule } from '../../auth/auth.module.js'
import { DialogueModule } from '../../../../../domains/conversation/domains/dialogue/dialogue.module.js'
import { DialoguesController } from './dialogues.controller.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [DialoguesController],
  imports: [AuthModule, DialogueModule],
})
export class DialoguesModule {}
