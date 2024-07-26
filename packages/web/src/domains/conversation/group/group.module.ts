import { Module } from '@nestjs/common'
import { RedisModule } from '../../../repositories/redis/redis.module.js'
import { conversation as conversationX } from './group.service.js'

export namespace conversation{
  @Module({
    exports: [conversationX.GroupService],
    imports: [RedisModule],
    providers: [conversationX.GroupService],
  })
  export class GroupModule {}
}
