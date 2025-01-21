import * as m1 from './pub-sub/shard.js'

export namespace pubSub{
  export const Shard = m1.Shard
  export type Shard<BufferMode extends boolean, Channel extends string, T> = m1.Shard<BufferMode, Channel, T>
}
