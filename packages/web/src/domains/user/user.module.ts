import { DrizzleModule } from '../../repositories/drizzle/drizzle.module.js'
import { Module } from '@nestjs/common'
import { RedisModule } from '../../repositories/redis/redis.module.js'
import { UserService } from './user.service.js'

@Module({
  exports: [UserService],
  imports: [DrizzleModule, RedisModule],
  providers: [UserService],
})
export class UserModule {}
