import { IdController, idPath } from './id.controller.js'
import { AuthModule } from '../../../auth/auth.module.js'
import { DialogueModule } from '../../../../../../domains/conversation/domains/dialogue/dialogue.module.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [IdController],
  imports: [AuthModule, DialogueModule],
  providers: [idPath.provider],
})
export class IdModule {}
