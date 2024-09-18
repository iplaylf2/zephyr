import { Isolable } from './common.js'
import { RedisClientType } from '@redis/client'
import { RedisCommandArgument } from '@redis/client/dist/lib/commands'
import { call } from 'effection'

export class Generic extends Isolable<Generic> {
  public constructor(public override readonly client: RedisClientType) {
    super()
  }

  public del(keys: RedisCommandArgument[]) {
    return call(this.client.del(keys))
  }

  public exists(keys: RedisCommandArgument[]) {
    return call(this.client.exists(keys))
  }

  public expire(key: RedisCommandArgument, seconds: number, mode?: 'GT' | 'LT' | 'NX' | 'XX') {
    return call(this.client.expire(key, seconds, mode))
  }

  public expireAt(key: RedisCommandArgument, timestamp: Date | number, mode?: 'GT' | 'LT' | 'NX' | 'XX') {
    return call(this.client.expireAt(key, timestamp, mode))
  }

  public ttl(key: RedisCommandArgument) {
    return call(this.client.ttl(key))
  }

  public watch(keys: readonly string[]) {
    return call(this.client.watch(keys as string[]))
  }

  protected override duplicate() {
    return new Generic(this.client.duplicate())
  }
}

export { RedisCommandArgument }
