import { Temporal } from 'temporal-polyfill'

export namespace commonWhere{
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
}
