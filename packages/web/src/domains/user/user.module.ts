import { Module } from '@nestjs/common'
import { PrismaModule } from '../../repositories/prisma/prisma.module.js'
import { RedisModule } from '../../repositories/redis/redis.module.js'
import { UserService } from './user.service.js'

@Module({
  exports: [UserService],
  imports: [RedisModule, PrismaModule],
  providers: [UserService],
})
export class UserModule {}
