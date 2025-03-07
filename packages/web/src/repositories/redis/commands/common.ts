import { call, resource } from 'effection'
import { Directive } from '@zephyr/kit/effection/operation.js'
import { RedisClientType } from '@redis/client'
import { RedisCommandArgument } from '@redis/client/dist/lib/commands/index.js'

export interface Model<T> {
  readonly client: RedisClientType
  readonly key: RedisCommandArgument

  decode(x: RedisCommandArgument): T
  encode(x: T): RedisCommandArgument
}

export abstract class Isolable<T extends Isolable<T>> {
  protected abstract readonly client: RedisClientType

  public* isolate(): Directive<T> {
    const duplication = this.duplicate()

    return yield* resource(function* (provide) {
      const client = duplication.client

      try {
        yield* call(
          () => client.connect(),
        )
        yield* provide(duplication)
      }
      finally {
        yield* call(
          () => client.disconnect(),
        )
      }
    })
  }

  protected abstract duplicate(): T
}

export { RedisCommandArgument }
