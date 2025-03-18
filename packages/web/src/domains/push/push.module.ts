import { DialogueModule } from '../conversation/domains/dialogue/dialogue.module.js'
import { GroupModule } from '../conversation/domains/group/group.module.js'
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../repositories/prisma/prisma.module.js'
import { PushService } from './push.service.js'
import { ReceiverService } from './receiver.service.js'
import { RedisModule } from '../../repositories/redis/redis.module.js'

@Module({
  exports: [PushService, ReceiverService],
  imports: [RedisModule, PrismaModule, DialogueModule, GroupModule],
  providers: [PushService, ReceiverService],
})
export class PushModule {}
