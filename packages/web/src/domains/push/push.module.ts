import { ConversationService } from '../../repositories/redis/entities/conversation.service.js'
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../repositories/prisma/prisma.module.js'
import { PushService } from './push.service.js'
import { ReceiverService } from './receiver.service.js'
import { RedisModule } from '../../repositories/redis/redis.module.js'

@Module({
  exports: [PushService, ReceiverService],
  imports: [RedisModule, PrismaModule, ConversationService],
  providers: [PushService, ReceiverService],
})
export class PushModule {}
