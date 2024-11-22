import { Model, RedisCommandArgument } from './common.js'
import { Operation, call } from 'effection'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { option, readonlyRecord } from 'fp-ts'
import { RedisClientType } from '@redis/client'

export abstract class Hash<T extends HashRecord> implements Model<T[string]> {
  public abstract readonly client: RedisClientType
  public abstract readonly key: RedisCommandArgument

  public decodeFully(value: Readonly<Record<string, RedisCommandArgument>>) {
    return pipe(
      value,
      readonlyRecord.map(v => this.decode(v)),
    ) as Readonly<Partial<T>>
  }

  public del(fields: RedisCommandArgument[]) {
    return call(this.client.hDel(this.key, fields))
  }

  public encodeFully(hash: Readonly<Partial<T>>) {
    return pipe(
      hash,
      readonlyRecord.filterMap(flow(
        option.fromNullable,
        option.map(x => this.encode(x)),
      )),
    )
  }

  public *get<K extends string & keyof T>(field: K): Operation<option.Option<T[K]>> {
    const value = yield * call(this.client.hGet(this.key, field))

    return pipe(
      value,
      option.fromNullable,
      option.map(x => this.decode(x) as T[K]),
    )
  }

  public *getAll(): Operation<Readonly<Partial<T>> | null> {
    const value = yield * call(this.client.hGetAll(this.key))

    return readonlyRecord.isEmpty(value) ? null : this.decodeFully(value)
  }

  public set(hash: Readonly<Partial<T>>) {
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
