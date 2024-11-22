import { Hash } from '../../commands/hash.js'
import { JsonObject } from 'type-fest'
import { RedisCommandArgument } from '../../commands/common.js'

export abstract class JsonHash<T extends JsonObject> extends Hash<T> {
  public override decode(x: RedisCommandArgument): T[string] {
    return JSON.parse(x.toString())
  }

  public override encode(x: T[string]): RedisCommandArgument {
    return JSON.stringify(x)
  }
}
