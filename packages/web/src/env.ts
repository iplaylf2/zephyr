import 'dotenv'
import { z } from 'zod'

export namespace env{
  export namespace prisma{
    export const datasourceUrl = z.string().parse(process.env['PRISMA_DATASOURCE_URL'])
  }

  export namespace redis{
    export const url = z.string().parse(process.env['REDIS_URL'])
  }
}
