import { Inject, Injectable } from '@nestjs/common'
import { Generic } from '../commands/generic.js'
import { RedisService } from '../redis.service.js'

@Injectable()
export class GenericService extends Generic {
  public constructor(@Inject() redisService: RedisService) {
    super(redisService)
  }
}
