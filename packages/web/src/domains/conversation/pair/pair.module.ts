import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../repositories/prisma/prisma.module.js'
import { RedisModule } from '../../../repositories/redis/redis.module.js'
import { UserModule } from '../../user/user.module.js'
import { conversation as conversationX } from './pair.service.js'

export namespace conversation{
  @Module({
    exports: [conversationX.PairService],
    imports: [UserModule, RedisModule, PrismaModule],
    providers: [conversationX.PairService],
  })
  export class PairModule {}
}
