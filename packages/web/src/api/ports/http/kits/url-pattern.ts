import { Abstract, FactoryProvider, InternalServerErrorException, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'

export namespace urlPattern{
  export function path<const K extends string>(name: K, transformer?: (x: string) => any): Abstract<{}> & {
    name: K
    pattern: `:${K}`
    provider: FactoryProvider
  } {
    abstract class InjectionToken {
      public static readonly name = name

      public static readonly pattern = `:${name}` as const

      public static readonly provider: FactoryProvider = {
        inject: [REQUEST],
        provide: InjectionToken,
        scope: Scope.REQUEST,
        useFactory(request: Request) {
          const value = request.params[name]

          if (undefined === value) {
            throw new InternalServerErrorException()
          }

          if (!transformer) {
            return value
          }

          return transformer(value)
        },
      }
    }

    return InjectionToken
  }
}
