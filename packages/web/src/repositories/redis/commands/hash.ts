import { Model, RedisCommandArgument } from './common.js'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { option, readonlyRecord } from 'fp-ts'
import { Directive } from '@zephyr/kit/effection/operation.js'
import { RedisClientType } from '@redis/client'
import { until } from 'effection'

export abstract class Hash<T extends HashRecord> implements Model<T[string]> {
  public abstract readonly client: RedisClientType
  public abstract readonly key: RedisCommandArgument

  public decodeAll(value: Readonly<Record<string, RedisCommandArgument>>) {
    return pipe(
      value,
      readonlyRecord.map(v => this.decode(v)),
    ) as Readonly<Partial<T>>
  }

  public del(fields: RedisCommandArgument[]) {
    return until(this.client.hDel(this.key, fields))
  }

  public encodeAll(hash: Readonly<Partial<T>>) {
    return pipe(
      hash,
      readonlyRecord.filterMap(
        flow(
          option.fromNullable,
          option.map(x => this.encode(x)),
        ),
      ),
    )
  }

  public* get<K extends string & keyof T>(field: K): Directive<option.Option<T[K]>> {
    const value = yield* until(this.client.hGet(this.key, field))

    return pipe(
      value,
      option.fromNullable,
      option.map(x => this.decode(x) as T[K]),
    )
  }

  public* getAll(): Directive<Readonly<Partial<T>> | null> {
    const value = yield* until(this.client.hGetAll(this.key))

    return readonlyRecord.isEmpty(value) ? null : this.decodeAll(value)
  }

  public set(hash: Readonly<Partial<T>>) {
    return until(
      this.client.hSet(this.key, this.encodeAll(hash)),
    )
  }

  public setNx<K extends string & keyof T>(key: K, value: T[K]) {
    return until(
      this.client.hSetNX(this.key, key, this.encode(value)),
    )
  }

  public abstract decode(x: RedisCommandArgument): T[string]
  public abstract encode(x: T[string]): RedisCommandArgument
}

export type HashRecord = Readonly<Record<string, any>>
