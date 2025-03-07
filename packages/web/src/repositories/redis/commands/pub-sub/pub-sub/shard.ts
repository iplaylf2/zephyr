import { PubSub, pubSub } from '../common.js'
import { call } from 'effection'

export abstract class Shard<
  const BufferMode extends boolean,
  Channel extends string,
  T,
> extends PubSub<BufferMode, Channel, T> {
  public override* publish(channel: Channel, message: T) {
    return yield* call(
      () => this.client.sPublish(channel, this.encode(message)),
    )
  }

  public override* subscribe(channel: Channel, listener: pubSub.Listener<T, Channel>) {
    return yield* call(
      () => this.client.sSubscribe(
        channel,
        this.cacheAndTransformListener(listener),
        this.bufferMode,
      ),
    )
  }

  public override* unsubscribe(channel?: Channel, listener?: pubSub.Listener<T, Channel>) {
    // listener 也许会复用，因此不能主动从 listenerMap 删除；WeakMap 会兜底的。

    const raw = listener && this.getRawListener(listener)

    return yield* call(
      () => this.client.sUnsubscribe(channel, raw, this.bufferMode),
    )
  }
}
