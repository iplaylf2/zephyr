import { Module } from '@nestjs/common'
import { RedisModule } from '../../repositories/redis/redis.module.js'
import { UserService } from './user.service.js'

@Module({
  exports: [UserService],
  imports: [RedisModule],
  providers: [UserService],
})
export class UserModule {
}
