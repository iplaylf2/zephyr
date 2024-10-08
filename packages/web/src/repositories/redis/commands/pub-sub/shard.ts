/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Operation, call } from 'effection'
import { apply, pipe } from 'fp-ts/lib/function.js'
import { io, ioEither } from 'fp-ts'
import { Isolable } from '../common.js'
import { PubSubListener } from '@redis/client/dist/lib/client/pub-sub.js'
import { RedisClientType } from '@redis/client'
import { RedisCommandArgument } from '../generic.js'

abstract class PubSub<
  const BufferMode extends boolean,
  Channel extends string,
  T,
> extends Isolable<PubSub<BufferMode, Channel, T>> {
  private readonly rawListenerMap = new WeakMap<pubSub.Listener<T, Channel>, PubSubListener<BufferMode>>()

  public abstract readonly bufferMode: BufferMode
  public abstract override readonly client: RedisClientType

  protected cacheAndTransformListener(listener: pubSub.Listener<T, Channel>) {
    return pipe(
      ioEither.of(listener),
      ioEither.flatMapNullable(
        x => this.rawListenerMap.get(x),
        x => x,
      ),
      ioEither.getOrElse(listener =>
        pipe(
          io.of(((message, channel) => listener(this.decode(message), channel.toString() as Channel)) satisfies PubSubListener<BufferMode>),
          io.tap(x => () => this.rawListenerMap.set(listener, x)),
        )),
      apply(void 0),
    )
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
  export abstract class Shard<
    const BufferMode extends boolean,
    Channel extends string,
    T,
  > extends PubSub<BufferMode, Channel, T> {
    public override publish(channel: Channel, message: T) {
      return call(this.client.sPublish(channel, this.encode(message)))
    }

    public override subscribe(channels: Channel, listener: Listener<T, Channel>) {
      return call(this.client.sSubscribe(channels as any, this.cacheAndTransformListener(listener), this.bufferMode))
    }

    public override unsubscribe(channels?: Channel, listener?: Listener<T, Channel>) {
      // listener 也许会复用，因此不能主动从 listenerMap 删除；WeakMap 会兜底的。

      const raw = listener && this.getRawListener(listener)

      return call(this.client.sUnsubscribe(channels as any, raw, this.bufferMode))
    }
  }

  export type Listener<T, Channel extends string> = (message: T, channel: Channel) => any
}
