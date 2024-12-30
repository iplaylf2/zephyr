import { IdController, idPath } from './id.controller.js'
import { AuthModule } from '../../../auth/auth.module.js'
import { Module } from '@nestjs/common'
import { conversation } from '../../../../../../domains/conversation/conversation.js'

@Module({
  controllers: [IdController],
  imports: [AuthModule, conversation.DialogueModule],
  providers: [idPath.provider],
})
export class IdModule {}
