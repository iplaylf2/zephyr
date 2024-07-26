import { IdController, idPath } from './id.controller.js'
import { Module } from '@nestjs/common'
import { ReceiverModule } from '../../../../../../domains/receiver/receiver.module.js'

@Module({
  controllers: [IdController],
  imports: [ReceiverModule],
  providers: [idPath.provider],
})
export class IdModule {
}
