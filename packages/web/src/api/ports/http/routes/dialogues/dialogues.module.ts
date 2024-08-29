import { AuthModule } from '../../auth/auth.module.js'
import { DialoguesController } from './dialogues.controller.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [DialoguesController],
  imports: [AuthModule],
})
export class DialoguesModule {
}
