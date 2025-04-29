/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Isolable, Model, RedisCommandArgument } from '../common.js'
import { constant, flow, pipe } from 'fp-ts/lib/function.js'
import { option, readonlyArray, readonlyRecord } from 'fp-ts'
import { ReadonlyDeep } from 'type-fest'
import { RedisClientType } from '@redis/client'
import { XAutoClaimOptions } from '@redis/client/dist/lib/commands/XAUTOCLAIM.js'
import { XReadGroupOptions } from '@redis/client/dist/lib/commands/XREADGROUP.js'
import { readonlyRecordPlus } from '@zephyr/kit/fp-ts/readonly-record-plus.js'
import { until } from 'effection'

export abstract class Stream<T extends StreamMessageBody> extends Isolable<Stream<T>> implements Model<T[string]> {
  public abstract override readonly client: RedisClientType
  public abstract readonly key: RedisCommandArgument

  public ack(group: RedisCommandArgument, id: readonly RedisCommandArgument[]) {
    return until(this.client.xAck(this.key, group, id as RedisCommandArgument[]))
  }

  public add(id: RedisCommandArgument, message: T, options?: XAddOptions) {
    return until(
      this.client.xAdd(
        this.key,
        id,
        this.encodeFully(message),
        options,
      ),
    )
  }

  public* autoClaim(
    group: RedisCommandArgument,
    consumer: RedisCommandArgument,
    minIdleTime: number,
    start: string,
    options?: XAutoClaimOptions,
  ) {
    const messages = yield* until(
      this.client.xAutoClaim(this.key, group, consumer, minIdleTime, start, options),
    )

    return pipe(
      messages,
      readonlyRecordPlus.modifyAt(
        'messages' as const,
        flow(
          readonlyArray.filterMap(flow(
            option.fromNullable,
            option.map(readonlyRecordPlus.modifyAt(
              'message' as const,
              x => this.decodeFully(x),
            )),
          )),
        ),
      ),
    )
  }

  public decodeFully(message: Readonly<Record<string, string>>) {
    return pipe(
      message,
      readonlyRecord.map(v => this.decode(v)),
    ) as T
  }

  public del(id: readonly RedisCommandArgument[]) {
    return until(this.client.xDel(this.key, id as RedisCommandArgument[]))
  }

  public encodeFully(message: T) {
    return pipe(
      message,
      readonlyRecord.map(v => this.encode(v as T[string])),
    )
  }

  public groupCreate(group: RedisCommandArgument, id: RedisCommandArgument, options?: XGroupCreateOptions) {
    return until(this.client.xGroupCreate(this.key, group, id, options))
  }

  public groupDestroy(group: RedisCommandArgument) {
    return until(this.client.xGroupDestroy(this.key, group))
  }

  public* infoStream() {
    try {
      return yield* until(this.client.xInfoStream(this.key))
    }
    catch (e) {
      if ('ERR no such key' !== (e as any)?.message) {
        throw e
      }

      return null
    }
  }

  public* range(start: RedisCommandArgument, end: RedisCommandArgument, options?: XRangeOptions) {
    const messages = yield* until(this.client.xRange(this.key, start, end, options))

    return pipe(
      messages,
      readonlyArray.map(
        readonlyRecordPlus.modifyAt('message' as const, x => this.decodeFully(x)),
      ),
    )
  }

  public* readGroup(group: RedisCommandArgument, consumer: RedisCommandArgument, id: RedisCommandArgument, options?: XReadGroupOptions) {
    const messages = yield* until(
      this.client.xReadGroup(group, consumer, { id, key: this.key }, options),
    )

    return pipe(
      messages ?? [],
      readonlyArray.head,
      option.map(flow(
        x => x.messages,
        readonlyArray.map(
          readonlyRecordPlus.modifyAt('message' as const, x => this.decodeFully(x)),
        ),
      )),
      option.getOrElse(constant<ReadonlyArray<StreamMessage<T>>>([])),
    )
  }

  public abstract decode(x: RedisCommandArgument): T[string]
  public abstract encode(x: T[string]): RedisCommandArgument
}

export type StreamMessage<T extends StreamMessageBody> = Readonly<{
  id: string
  message: T
}>
export type StreamMessageBody = Readonly<Record<string, any>>
export type XAddOptions = ReadonlyDeep<{
  NOMKSTREAM?: true
  TRIM?: {
    limit?: number
    strategy?: 'MAXLEN' | 'MINID'
    strategyModifier?: '=' | '~'
    threshold: number
  }
}>
export type XRangeOptions = Readonly<{
  COUNT?: number
}>
export type XGroupCreateOptions = Readonly<{
  MKSTREAM?: true
}>
export { XAutoClaimOptions, XReadGroupOptions }
