import { Module } from '@nestjs/common'
import { PrismaModule } from '../../repositories/prisma/prisma.module.js'
import { PushService } from './push.service.js'
import { ReceiverService } from './receiver.service.js'
import { RedisModule } from '../../repositories/redis/redis.module.js'
import { conversation } from '../conversation/conversation.js'

@Module({
  exports: [PushService, ReceiverService],
  imports: [RedisModule, PrismaModule, conversation.DialogueModule, conversation.GroupModule],
  providers: [PushService, ReceiverService],
})
export class PushModule {}
