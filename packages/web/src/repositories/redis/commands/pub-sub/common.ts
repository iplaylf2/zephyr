import { Isolable, RedisCommandArgument } from '../common.js'
import { either, ioEither } from 'fp-ts'
import { Operation } from 'effection'
import { PubSubListener } from '@redis/client/dist/lib/client/pub-sub.js'
import { RedisClientType } from '@redis/client'
import { pipe } from 'fp-ts/lib/function.js'

export abstract class PubSub<
  const BufferMode extends boolean,
  Channel extends string,
  T,
> extends Isolable<PubSub<BufferMode, Channel, T>> {
  private readonly rawListenerMap = new WeakMap<pubSub.Listener<T, Channel>, PubSubListener<BufferMode>>()

  public abstract readonly bufferMode: BufferMode
  public abstract override readonly client: RedisClientType

  protected cacheAndTransformListener(listener: pubSub.Listener<T, Channel>) {
    return pipe(
      () => either.fromNullable(null)(this.rawListenerMap.get(listener)),
      ioEither.mapLeft(
        () => ((message, channel) =>
          listener(this.decode(message), channel.toString() as Channel)) satisfies
        PubSubListener<BufferMode>,
      ),
      ioEither.orElseFirstIOK(
        newListener => () => this.rawListenerMap.set(listener, newListener),
      ),
      ioEither.toUnion,
    )()
  }

  protected getRawListener(listener: pubSub.Listener<T, Channel>) {
    return this.rawListenerMap.get(listener)
  }

  public abstract decode(x: BufferMode extends true ? RedisCommandArgument : string): T
  public abstract encode(x: T): BufferMode extends true ? RedisCommandArgument : string
  public abstract publish(channel: Channel, message: T): Operation<number>
  public abstract subscribe(channels: Channel, listener: pubSub.Listener<T, Channel>): Operation<void>
  public abstract unsubscribe(channels?: Channel, listener?: pubSub.Listener<T, Channel>): Operation<void>
}

export namespace pubSub{
  export type Listener<T, Channel extends string> = (message: T, channel: Channel) => any
}
