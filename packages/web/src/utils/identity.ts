// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function unsafeCoerce<B>() {
  return <const A>(a: A): A extends B ? B : B extends A ? B : never => a as any
}

export function coerceReadonly<const A extends {}>(a: A): Readonly<A> {
  return a
}
