import { AuthModule } from '../../../auth/auth.module.js'
import { MemberController } from './member.controller.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [MemberController],
  imports: [AuthModule],
})
export class MemberModule {
}
