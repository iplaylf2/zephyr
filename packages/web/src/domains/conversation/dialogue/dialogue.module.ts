import { DialogueService } from './dialogue.service.js'
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../repositories/prisma/prisma.module.js'
import { RedisModule } from '../../../repositories/redis/redis.module.js'
import { UserModule } from '../../user/user.module.js'

@Module({
  exports: [DialogueService],
  imports: [UserModule, RedisModule, PrismaModule],
  providers: [DialogueService],
})
export class DialogueModule {}
