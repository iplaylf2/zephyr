import { IdController, idPath } from './id.controller.js'
import { AuthModule } from '../../../auth/auth.module.js'
import { GroupModule } from '../../../../../../domains/conversation/domains/group/group.module.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [IdController],
  imports: [AuthModule, GroupModule],
  providers: [idPath.provider],
})
export class IdModule {}
