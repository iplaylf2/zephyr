import { JsonValue } from 'type-fest'
import { pubSub } from '../../../commands/pub-sub/shard.js'

export namespace jsonPubSub{
  export abstract class Shard<
    Channel extends string,
    T extends JsonValue,
  > extends pubSub.Shard<true, Channel, T> {
    public override readonly bufferMode = true

    public override decode(x: string): T {
      return JSON.parse(x)
    }

    public override encode(x: T): string {
      return JSON.stringify(x)
    }
  }
}
