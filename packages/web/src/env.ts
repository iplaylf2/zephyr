import 'dotenv'
import { z } from 'zod'

export namespace env{
  enum key {
    AUTH_SECRET = 'AUTH_SECRET',
    PRISMA_DATASOURCE_URL = 'PRISMA_DATASOURCE_URL',
    REDIS_URL = 'REDIS_URL',
  }

  export namespace auth{
    export const secret = parseEnv(key.AUTH_SECRET)
  }

  export namespace prisma{
    export const datasourceUrl = parseEnv(key.PRISMA_DATASOURCE_URL)
  }

  export namespace redis{
    export const url = parseEnv(key.REDIS_URL)
  }

  function parseEnv<T extends z.ZodType = z.ZodString>(
    key: key,
    factory: (source: z.ZodString) => T = x => x as unknown as T,
  ): z.output<T> {
    const result = factory(z.string()).safeParse(process.env[key])

    if (result.success) {
      return result.data
    }

    result.error.addIssues(
      [{
        code: 'custom',
        message: `env.${key} is invalid`,
        path: [key],
      }],
    )

    throw result.error
  }
}
