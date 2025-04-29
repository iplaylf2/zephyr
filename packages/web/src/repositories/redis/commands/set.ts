import { Model, RedisCommandArgument } from './common.js'
import { RedisClientType } from '@redis/client'
import { until } from 'effection'

export abstract class Set implements Model<RedisCommandArgument> {
  public abstract readonly client: RedisClientType
  public abstract readonly key: RedisCommandArgument

  public add(members: readonly RedisCommandArgument[]) {
    return until(
      this.client.sAdd(this.key, members as RedisCommandArgument[]),
    )
  }

  public decode(x: RedisCommandArgument): RedisCommandArgument {
    return x
  }

  public del(members: readonly RedisCommandArgument[]) {
    return until(
      this.client.sRem(this.key, members as RedisCommandArgument[]),
    )
  }

  public encode(x: RedisCommandArgument): RedisCommandArgument {
    return x
  }

  public members() {
    return until(this.client.sMembers(this.key))
  }
}
