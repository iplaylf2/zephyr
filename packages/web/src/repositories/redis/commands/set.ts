import { Model } from './common.js'
import { RedisClientType } from '@redis/client'
import { RedisCommandArgument } from './generic.js'
import { call } from 'effection'

export abstract class Set implements Model<RedisCommandArgument> {
  public abstract readonly client: RedisClientType
  public abstract readonly key: RedisCommandArgument

  public add(members: readonly RedisCommandArgument[]) {
    return call(this.client.sAdd(this.key, members as RedisCommandArgument[]))
  }

  public decode(x: RedisCommandArgument): RedisCommandArgument {
    return x
  }

  public del(members: readonly RedisCommandArgument[]) {
    return call(this.client.sRem(this.key, members as RedisCommandArgument[]))
  }

  public encode(x: RedisCommandArgument): RedisCommandArgument {
    return x
  }

  public members() {
    return call(this.client.sMembers(this.key))
  }
}
