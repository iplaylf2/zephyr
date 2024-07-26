import { JsonObject } from 'type-fest'
import { RedisCommandArgument } from '../../commands/generic.js'
import { Stream } from '../../commands/stream/stream.js'

export abstract class JsonStream<T extends JsonObject> extends Stream<T> {
  public override decode(x: RedisCommandArgument): T[string] {
    return JSON.parse(x.toString())
  }

  public override encode(x: T[string]): RedisCommandArgument {
    return JSON.stringify(x)
  }
}
