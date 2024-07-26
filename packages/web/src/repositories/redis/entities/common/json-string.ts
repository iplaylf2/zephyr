import { JsonValue } from 'type-fest'
import { RedisCommandArgument } from '../../commands/generic.js'
import { String } from '../../commands/string.js'

export abstract class JsonString<T extends JsonValue> extends String<T> {
  public override decode(x: RedisCommandArgument): T {
    return JSON.parse(x.toString())
  }

  public override encode(x: T): RedisCommandArgument {
    return JSON.stringify(x)
  }
}
