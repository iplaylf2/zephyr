import { PgTimestampConfig, customType } from 'drizzle-orm/pg-core'
import { Temporal } from 'temporal-polyfill'

export const timestamp = customType<{
  config: Pick<PgTimestampConfig, 'precision'>
  data: Temporal.Instant
  driverData: string
}>({
  dataType(config) {
    return `timestamp${
      undefined === config?.precision ? '' : (` (${config.precision.toString()})`)
    } with time zone`
  },
  fromDriver(value) {
    return Temporal.Instant.from(value)
  },
  toDriver(value) {
    return value.toString()
  },
})
