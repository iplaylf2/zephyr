export type Callable<T = any, Params = any, Return = any> = (this: T, ...params: Params) => Return
