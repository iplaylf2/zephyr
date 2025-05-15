export namespace arrayPlus{
  export function writable<T>(x: readonly T[]): T[] {
    return x as T[]
  }
}
