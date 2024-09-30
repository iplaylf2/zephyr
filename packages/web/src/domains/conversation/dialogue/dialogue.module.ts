import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../repositories/prisma/prisma.module.js'
import { RedisModule } from '../../../repositories/redis/redis.module.js'
import { UserModule } from '../../user/user.module.js'
import { conversation as conversationX } from './dialogue.service.js'

export namespace conversation{
  @Module({
    exports: [conversationX.DialogueService],
    imports: [UserModule, RedisModule, PrismaModule],
    providers: [conversationX.DialogueService],
  })
  export class DialogueModule {}
}
