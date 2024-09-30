import { IdController, idPath } from './id.controller.js'
import { AuthModule } from '../../../auth/auth.module.js'
import { Module } from '@nestjs/common'
import { conversation } from '../../../../../../domains/conversation/group/group.module.js'

@Module({
  controllers: [IdController],
  imports: [AuthModule, conversation.GroupModule],
  providers: [idPath.provider],
})
export class IdModule {}
