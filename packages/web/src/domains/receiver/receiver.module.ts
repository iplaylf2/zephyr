import { Module } from '@nestjs/common'
import { PrismaModule } from '../../repositories/prisma/prisma.module.js'
import { ReceiverService } from './receiver.service.js'
import { RedisModule } from '../../repositories/redis/redis.module.js'

@Module({
  exports: [ReceiverService],
  imports: [RedisModule, PrismaModule],
  providers: [ReceiverService],
})
export class ReceiverModule {}
