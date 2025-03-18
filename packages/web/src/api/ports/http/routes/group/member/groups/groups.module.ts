import { AuthModule } from '../../../../auth/auth.module.js'
import { GroupModule } from '../../../../../../../domains/conversation/domains/group/group.module.js'
import { GroupsController } from './groups.controller.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [GroupsController],
  imports: [AuthModule, GroupModule],
})
export class GroupsModule {}
