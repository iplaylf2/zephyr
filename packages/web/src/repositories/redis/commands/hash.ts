import { Operation, call } from 'effection'
import { option, readonlyRecord } from 'fp-ts'
import { Model } from './common.js'
import { Option } from 'fp-ts/lib/Option.js'
import { RedisClientType } from '@redis/client'
import { RedisCommandArgument } from './generic.js'
import { pipe } from 'fp-ts/lib/function.js'

export abstract class Hash<T extends HashRecord> implements Model<T[string]> {
  public abstract readonly client: RedisClientType
  public abstract readonly key: RedisCommandArgument

  public decodeFully(value: Readonly<Record<string, RedisCommandArgument>>) {
    return pipe(
      value,
      readonlyRecord.map(v => this.decode(v)),
    ) as Partial<T>
  }

  public encodeFully(hash: Partial<T>) {
    return pipe(
      hash,
      readonlyRecord.filterMap(
        v => undefined === v
          ? option.none
          : option.some(this.encode(v),
          ),
      ),
    )
  }

  public *get<K extends string & keyof T>(field: K): Operation<Option<T[K]>> {
    const value = yield * call(this.client.hGet(this.key, field))

    return pipe(
      value,
      x => undefined === x ? option.none : option.some(x),
      option.map(x => this.decode(x) as T[K]),
    )
  }

  public *getAll(): Operation<Partial<T> | null> {
    const value = yield * call(this.client.hGetAll(this.key))

    return readonlyRecord.isEmpty(value) ? null : this.decodeFully(value)
  }

  public set(hash: Partial<T>) {
    return call(this.client.hSet(
      this.key,
      this.encodeFully(hash),
    ))
  }

  public setNx<K extends string & keyof T>(key: K, value: T[K]) {
    return call(this.client.hSetNX(this.key, key, this.encode(value)))
  }

  public abstract decode(x: RedisCommandArgument): T[string]
  public abstract encode(x: T[string]): RedisCommandArgument
}

export type HashRecord = Readonly<Record<string, any>>
