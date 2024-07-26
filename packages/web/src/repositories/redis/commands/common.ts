import { Operation, call, resource } from 'effection'
import { RedisClientType } from '@redis/client'
import { RedisCommandArgument } from './generic.js'

export interface Model<T> {
  readonly client: RedisClientType
  readonly key: RedisCommandArgument

  decode(x: RedisCommandArgument): T
  encode(x: T): RedisCommandArgument
}

export abstract class Isolable<T extends Isolable<T>> {
  protected abstract readonly client: RedisClientType

  public isolate(): Operation<T> {
    const duplication = this.duplicate()

    return resource(function*(provide) {
      const client = duplication.client

      try {
        yield * call(client.connect())
        yield * provide(duplication)
      }
      finally {
        yield * call(client.quit())
      }
    })
  }

  protected abstract duplicate(): T
}
