import { Model, RedisCommandArgument } from './common.js'
import { ReadonlyDeep } from 'type-fest'
import { RedisClientType } from '@redis/client'
import { ZMember } from '@redis/client/dist/lib/commands/generic-transformers.js'
import { call } from 'effection'

export abstract class SortedSet implements Model<RedisCommandArgument> {
  public abstract readonly client: RedisClientType
  public abstract readonly key: RedisCommandArgument

  public add(members: readonly ZMember[], options?: ZAddOptions) {
    return call(this.client.zAdd(this.key, members as ZMember[], options))
  }

  public card() {
    return call(this.client.zCard(this.key))
  }

  public count(min: RedisCommandArgument | number, max: RedisCommandArgument | number) {
    return call(this.client.zCount(this.key, min, max))
  }

  public decode(x: RedisCommandArgument): RedisCommandArgument {
    return x
  }

  public encode(x: RedisCommandArgument): RedisCommandArgument {
    return x
  }

  public mScore(members: readonly RedisCommandArgument[]) {
    return call(this.client.zmScore(this.key, members as RedisCommandArgument[]))
  }

  public range(min: RedisCommandArgument | number, max: RedisCommandArgument | number, options?: ZRangeOptions) {
    return call(this.client.zRange(this.key, min, max, options))
  }

  public rangeWithScores(min: RedisCommandArgument | number, max: RedisCommandArgument | number, options?: ZRangeOptions) {
    return call(this.client.zRangeWithScores(this.key, min, max, options))
  }

  public rem(members: readonly RedisCommandArgument[]) {
    return call(this.client.zRem(this.key, members as RedisCommandArgument[]))
  }

  public remRangeByScore(min: RedisCommandArgument | number, max: RedisCommandArgument | number) {
    return call(this.client.zRemRangeByScore(this.key, min, max))
  }

  public score(member: RedisCommandArgument) {
    return call(this.client.zScore(this.key, member))
  }
}

interface NX {
  NX?: true
}
interface XX {
  XX?: true
}
interface LT {
  LT?: true
}
interface GT {
  GT?: true
}
interface CH {
  CH?: true
}
interface INCR {
  INCR?: true
}

export { ZMember }
export type ZAddOptions = Readonly<CH & INCR & (NX | (GT & LT & XX))>
export type ZRangeOptions = ReadonlyDeep<{
  BY?: 'LEX' | 'SCORE'
  LIMIT?: {
    count: number
    offset: number
  }
  REV?: true
}>
