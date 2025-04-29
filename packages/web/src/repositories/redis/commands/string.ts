import { Model, RedisCommandArgument } from './common.js'
import { RedisClientType, SetOptions } from '@redis/client'
import { Directive } from '@zephyr/kit/effection/operation.js'
import { option } from 'fp-ts'
import { pipe } from 'fp-ts/lib/function.js'
import { until } from 'effection'

export abstract class String<T> implements Model<T> {
  public abstract readonly client: RedisClientType
  public abstract readonly key: RedisCommandArgument

  public* get(): Directive<option.Option<T>> {
    const value = yield* until(this.client.get(this.key))

    return pipe(
      value,
      option.fromNullable,
      option.map(x => this.decode(x)),
    )
  }

  public set(value: T, options?: SetOptions) {
    return until(
      this.client.set(this.key, this.encode(value), options),
    )
  }

  public abstract decode(x: RedisCommandArgument): T
  public abstract encode(x: T): RedisCommandArgument
}
