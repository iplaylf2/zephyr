import { AuthModule } from '../../auth/auth.module.js'
import { DialogueController } from './dialogue.controller.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [DialogueController],
  imports: [AuthModule],
})
export class DialogueModule {
}
