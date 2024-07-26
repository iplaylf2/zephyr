import { Operation, call } from 'effection'
import { Option, fromNullable, map } from 'fp-ts/lib/Option.js'
import { RedisClientType, SetOptions } from '@redis/client'
import { Model } from './common.js'
import { RedisCommandArgument } from './generic.js'
import { pipe } from 'fp-ts/lib/function.js'

export abstract class String<T> implements Model<T> {
  public abstract readonly client: RedisClientType
  public abstract readonly key: RedisCommandArgument

  public *get(): Operation<Option<T>> {
    const value = yield * call(this.client.get(this.key))

    return pipe(
      value,
      fromNullable,
      map(x => this.decode(x)),
    )
  }

  public set(value: T, options?: SetOptions) {
    return call(this.client.set(this.key, this.encode(value), options))
  }

  public abstract decode(x: RedisCommandArgument): T
  public abstract encode(x: T): RedisCommandArgument
}
