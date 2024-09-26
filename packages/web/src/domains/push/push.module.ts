import { Module } from '@nestjs/common'
import { PrismaModule } from '../../repositories/prisma/prisma.module.js'
import { PushService } from './push.service.js'
import { RedisModule } from '../../repositories/redis/redis.module.js'

@Module({
  exports: [PushService],
  imports: [RedisModule, PrismaModule],
  providers: [PushService],
})
export class PushModule {}
