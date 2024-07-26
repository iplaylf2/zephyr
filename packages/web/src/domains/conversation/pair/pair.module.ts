import { Module } from '@nestjs/common'
import { RedisModule } from '../../../repositories/redis/redis.module.js'
import { conversation as conversationX } from './pair.service.js'

export namespace conversation{
  @Module({
    exports: [conversationX.PairService],
    imports: [RedisModule],
    providers: [conversationX.PairService],
  })
  export class PairModule {}
}
