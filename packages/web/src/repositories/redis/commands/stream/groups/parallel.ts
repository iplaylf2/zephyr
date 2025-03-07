import { Operation, each, ensure, scoped, sleep, spawn } from 'effection'
import { PartialDeep, ReadonlyDeep } from 'type-fest'
import { Stream, StreamMessage, StreamMessageBody } from '../stream.js'
import { Plan } from '@zephyr/kit/effection/operation.js'
import { RedisCommandArgument } from '../../common.js'
import defaults from 'defaults'
import { either } from 'fp-ts'
import { pipe } from 'fp-ts/lib/function.js'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { stream } from '@zephyr/kit/fp-effection/stream.js'
import { streamPlus } from '@zephyr/kit/effection/stream-plus.js'

export class Parallel<T extends StreamMessageBody> {
  private readonly config: Parallel.Config

  public constructor(
    protected readonly stream: Stream<T>,
    public readonly group: RedisCommandArgument,
    options?: Parallel.Options,
  ) {
    this.config = defaults(
      options ?? {},
      { message: { ackInternal: 30_000, claimIdleLimit: 100, minIdleTime: 60_000 } },
    )
  }

  public get key() {
    return this.stream.key
  }

  public read(consumer: RedisCommandArgument, f: (x: StreamMessage<T>) => Operation<any>) {
    return scoped(
      function* (this: Parallel<T>) {
        let processed: string[] = []

        yield* ensure(() => 0 === processed.length ? (void 0) : this.ack(processed))

        const blockStream = yield* this.stream.isolate()

        const { ackInternal, claimIdleLimit, minIdleTime } = this.config.message

        void (yield* spawn(function* (this: Parallel<T>) {
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

        const newMessages = streamPlus.generate(
          () => blockStream.readGroup(this.group, consumer, '>', { BLOCK: 0, COUNT: 1 }),
        )
        const idleMessages = streamPlus.generate(pipe(
          () => sleep(minIdleTime / 2),
          Plan.fromOperationPlan,
          plan.chain(
            () => plan.ChainRec.chainRec(null, () => pipe(
              () => this.stream.autoClaim(
                this.group,
                consumer,
                minIdleTime,
                '0',
                { COUNT: claimIdleLimit },
              ),
              plan.map((x) => {
                if (0 < x.messages.length) {
                  return either.right(x.messages)
                }

                if ('0-0' === x.nextId) {
                  return either.right([])
                }

                return either.left(null)
              }),
            )),
          ),
        ))

        const messages = stream
        // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
          .getMonoidPar<void, StreamMessage<T>>()
          .concat(newMessages, idleMessages)

        for (const message of yield* each(messages)) {
          void (yield* spawn(function* () {
            yield* f(message)

            processed.push(message.id)
          }))

          yield* each.next()
        }
      }.bind(this),
    )
  }

  private ack(id: readonly RedisCommandArgument[]) {
    return this.stream.ack(this.group, id)
  }
}

export namespace Parallel{
  export type Config = ReadonlyDeep<{
    message: {
      ackInternal: number
      claimIdleLimit: number
      minIdleTime: number
    }
  }>

  export type Options = PartialDeep<Config>
}
