import { Writable } from 'type-fest'

export namespace where{
  export function writable<T>(x: T): Writable<T> {
    return x as Writable<T>
  }
}
