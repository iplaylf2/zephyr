import { JsonPrimitive } from 'type-fest'

export class JKMap<Keys extends readonly JsonPrimitive[], T> {
  private readonly underlying = new Map<string, T>()

  public clear() {
    this.underlying.clear()
  }

  public delete(keys: Keys) {
    return this.underlying.delete(JSON.stringify(keys))
  }

  public get(keys: Keys) {
    return this.underlying.get(JSON.stringify(keys))
  }

  public has(keys: Keys) {
    return this.underlying.has(JSON.stringify(keys))
  }

  public set(keys: Keys, value: T) {
    return this.underlying.set(JSON.stringify(keys), value)
  }

  public values() {
    return this.underlying.values()
  }
}
