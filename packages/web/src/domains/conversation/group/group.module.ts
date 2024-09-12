import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../repositories/prisma/prisma.module.js'
import { RedisModule } from '../../../repositories/redis/redis.module.js'
import { conversation as conversationX } from './group.service.js'

export namespace conversation{
  @Module({
    exports: [conversationX.GroupService],
    imports: [RedisModule, PrismaModule],
    providers: [conversationX.GroupService],
  })
  export class GroupModule {}
}
