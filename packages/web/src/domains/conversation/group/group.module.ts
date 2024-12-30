import { GroupService } from './group.service.js'
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../repositories/prisma/prisma.module.js'
import { RedisModule } from '../../../repositories/redis/redis.module.js'
import { UserModule } from '../../user/user.module.js'

@Module({
  exports: [GroupService],
  imports: [UserModule, RedisModule, PrismaModule],
  providers: [GroupService],
})
export class GroupModule {}
