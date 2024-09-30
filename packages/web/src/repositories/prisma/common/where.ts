import { Temporal } from 'temporal-polyfill'
import { Writable } from 'type-fest'

export namespace where{
  export function halfLife(expire: Temporal.Duration) {
    const halfSeconds = expire.total('seconds') / 2
    const halfExpiredAt = Temporal.Now
      .zonedDateTimeISO()
      .add({ seconds: halfSeconds })

    return {
      expiredAt: {
        gt: new Date(),
        lte: new Date(halfExpiredAt.epochMilliseconds),
      },
      lastActiveAt: {
        gt: new Date(
          halfExpiredAt.subtract(expire).epochMilliseconds,
        ),
      },
    }
  }

  export function writable<T>(x: T): Writable<T> {
    return x as Writable<T>
  }
}
