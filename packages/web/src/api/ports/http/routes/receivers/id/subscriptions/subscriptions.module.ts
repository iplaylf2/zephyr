import { Module } from '@nestjs/common'
import { SubscriptionsController } from './subscriptions.controller.js'
import { path } from '../../../../pattern.js'

@Module({
  controllers: [SubscriptionsController],
  providers: [path.receiver.provider],
})
export class SubscriptionsModule {
}
