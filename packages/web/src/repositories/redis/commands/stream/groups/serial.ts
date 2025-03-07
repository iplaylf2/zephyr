import { Operation, each, ensure, scoped, sleep, spawn } from 'effection'
import { PartialDeep, ReadonlyDeep } from 'type-fest'
import { Stream, StreamMessage, StreamMessageBody } from '../stream.js'
import { RedisCommandArgument } from '../../common.js'
import defaults from 'defaults'
import { stream } from '@zephyr/kit/fp-effection/stream.js'
import { streamPlus } from '@zephyr/kit/effection/stream-plus.js'

export class Serial<T extends StreamMessageBody> {
  private readonly config: Serial.Config

  public constructor(
    protected readonly stream: Stream<T>,
    public readonly group: RedisCommandArgument,
    options?: Serial.Options,
  ) {
    this.config = defaults(options ?? {}, { message: { ackInternal: 60_000, batchLimit: 100 } })
  }

  public get key() {
    return this.stream.key
  }

  public read(consumer: RedisCommandArgument, f: (x: StreamMessage<T>) => Operation<any>) {
    return scoped(
      function* (this: Serial<T>) {
        let processed: string[] = []

        yield* ensure(() => 0 === processed.length ? (void 0) : this.ack(processed))

        const blockStream = yield* this.stream.isolate()

        const { ackInternal, batchLimit } = this.config.message

        void (yield* spawn(function* (this: Serial<T>) {
          while (true) {
            yield* sleep(ackInternal)

            if (0 === processed.length) {
              continue
            }

            const _processed = processed.slice()

            processed = []

            yield* this.ack(_processed)
          }
        }.bind(this)))

        const pendingMessages = streamPlus.generate(
          () => this.stream.readGroup(this.group, consumer, '0', { COUNT: batchLimit }),
        )
        const newMessages = streamPlus.generate(
          () => blockStream.readGroup(this.group, consumer, '>', { BLOCK: 0, COUNT: batchLimit }),
        )

        const messages = stream
        // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
          .getMonoid<void, StreamMessage<T>>()
          .concat(pendingMessages, newMessages)

        for (const message of yield* each(messages)) {
          yield* f(message)

          processed.push(message.id)

          yield* each.next()
        }
      }.bind(this),
    )
  }

  private ack(id: readonly RedisCommandArgument[]) {
    return this.stream.ack(this.group, id)
  }
}

export namespace Serial{
  export type Config = ReadonlyDeep<{
    message: {
      ackInternal: number
      batchLimit: number
    }
  }>

  export type Options = PartialDeep<Config>
}
