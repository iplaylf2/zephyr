import { Module } from '@nestjs/common'
import { PushModule } from '../../../domains/push/push.module.js'
import { WsService } from './ws.service.js'

@Module({
  imports: [PushModule],
  providers: [WsService],
})
export class WsModule {}
