import { Module } from '@nestjs/common'
import { ReceiverService } from './receiver.service.js'

@Module({
  exports: [ReceiverService],
  providers: [ReceiverService],
})
export class ReceiverModule {}
