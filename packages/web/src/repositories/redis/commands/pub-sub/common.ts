import { Isolable, RedisCommandArgument } from '../common.js'
import { constant, flow, pipe } from 'fp-ts/lib/function.js'
import { io, ioOption, option } from 'fp-ts'
import { Operation } from 'effection'
import { PubSubListener } from '@redis/client/dist/lib/client/pub-sub.js'
import { RedisClientType } from '@redis/client'

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
      () => this.rawListenerMap.get(listener),
      io.map(option.fromNullable),
      ioOption.getOrElse(
        flow(
          constant(
            ((message, channel) =>
              listener(this.decode(message), channel.toString() as Channel)) satisfies
            PubSubListener<BufferMode>,
          ),
          io.of,
          io.tap(x => () => this.rawListenerMap.set(listener, x)),
        ),
      ),
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
