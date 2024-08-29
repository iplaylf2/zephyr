import { Operation, each, ensure, sleep, spawn } from 'effection'
import { PartialDeep, ReadonlyDeep } from 'type-fest'
import { Stream, StreamMessage, StreamMessageBody } from '../stream.js'
import { RedisCommandArgument } from '../../generic.js'
import defaults from 'defaults'
import { stream } from '../../../../../kits/effection/stream.js'

export namespace group{
  export class Parallel<T extends StreamMessageBody> {
    private readonly config: Parallel.Config

    public constructor(
      protected readonly stream: Stream<T>,
      public readonly group: RedisCommandArgument,
      options?: Parallel.Options,
    ) {
      this.config = defaults(options ?? {}, { message: { ackInternal: 60_000, batchLimit: 100 } })
    }

    public get key() {
      return this.stream.key
    }

    public *read(consumer: RedisCommandArgument, f: (x: StreamMessage<T>) => Operation<any>) {
      let processed: string[] = []

      yield * this.stream.groupCreate(this.group, '0', { MKSTREAM: true })
      yield * ensure(
        () => 0 === processed.length ? (void 0) : this.ack(processed),
      )

      const blockStream = yield * this.stream.isolate()

      const { ackInternal, batchLimit } = this.config.message

      void (yield * spawn(function*(this: Parallel<T>) {
        while (true) {
          yield * sleep(ackInternal)

          if (0 === processed.length) {
            continue
          }

          const _processed = processed.slice()

          processed = []

          yield * this.ack(_processed)
        }
      }.bind(this)))

      const pendingMessages = stream.exhaust(() => this.stream.readGroup(this.group, consumer, '0', { COUNT: batchLimit }))
      const newMessages = stream.exhaust(() => blockStream.readGroup(this.group, consumer, '>', { BLOCK: 0, COUNT: batchLimit }))

      for (const message of yield * each(stream.concat(pendingMessages, newMessages))) {
        void (yield * spawn(function*() {
          yield * f(message)

          processed.push(message.id)
        }))

        yield * each.next()
      }
    }

    private ack(id: readonly RedisCommandArgument[]) {
      return this.stream.ack(this.group, id)
    }
  }

  export namespace Parallel{
    export type Config = ReadonlyDeep<{
      message: {
        ackInternal: number
        batchLimit: number
      }
    }>

    export type Options = PartialDeep<Config>
  }
}
