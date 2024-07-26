import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { JsonHash } from './common/json-hash.js'
import { JsonStream } from './common/json-stream.js'
import { RedisClientType } from '@redis/client'
import { RedisService } from '../redis.service.js'
import { SortedSet } from '../commands/sorted-set.js'
import { call } from 'effection'
import { globalScope } from '../../../kits/effection/global-scope.js'
import { user } from '../../../models/user.js'

@Injectable()
export class UserService implements OnModuleInit {
  @Inject() private readonly redisService!: RedisService

  public get() {
    return new Users(this.redisService)
  }

  public getEvent() {
    return new User.Event(this.redisService)
  }

  public getInfo(id: string) {
    return new User.Info(this.redisService, id)
  }

  public onModuleInit() {
    void globalScope.run(function*(this: UserService) {
      const event = this.getEvent()
      const forCreation = 'for-creation'

      yield * call(this.redisService.multi()
        .xGroupCreate(event.key, forCreation, '$', { MKSTREAM: true })
        .xGroupDestroy(event.key, forCreation)
        .exec(),
      )
    }.bind(this))
  }
}

export class Users extends SortedSet {
  public override readonly key = `sorted-set://users`

  public constructor(public override client: RedisClientType) {
    super()
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

  export class Info extends JsonHash<user.Info> {
    public override readonly key

    public constructor(public override client: RedisClientType, id: string) {
      super()

      this.key = `hash://users/${encodeURIComponent(id)}/info`
    }
  }
}
