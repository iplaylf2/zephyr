import { Module } from '@nestjs/common'
import { ReceiverModule } from '../../../domains/receiver/receiver.module.js'
import { WsService } from './ws.service.js'

@Module({
  imports: [ReceiverModule],
  providers: [WsService],
})
export class WsModule {}
