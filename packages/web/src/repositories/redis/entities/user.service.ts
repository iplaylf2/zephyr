import { Inject, Injectable } from '@nestjs/common'
import { JsonStream } from './common/json-stream.js'
import { ModuleRaii } from '../../../common/module-raii.js'
import { RedisClientType } from '@redis/client'
import { RedisService } from '../redis.service.js'
import { call } from 'effection'
import { user } from '../../../models/user.js'

@Injectable()
export class UserService extends ModuleRaii {
  @Inject() private readonly redisService!: RedisService

  public constructor() {
    super()

    this.initializeCallbacks.push(
      function*(this: UserService) {
        const event = this.getEvent()
        const forCreation = 'for-creation'

        yield * call(
          () => this.redisService.multi()
            .xGroupCreate(event.key, forCreation, '$', { MKSTREAM: true })
            .xGroupDestroy(event.key, forCreation)
            .exec(),
        )
      }.bind(this),
    )
  }

  public getEvent() {
    return new User.Event(this.redisService)
  }
}

export namespace User{
  export class Event extends JsonStream<user.Event> {
    public override readonly key = `stream://user/event`

    public constructor(public override client: RedisClientType) {
      super()
    }

    protected override duplicate() {
      return new Event(this.client.duplicate())
    }
  }
}
