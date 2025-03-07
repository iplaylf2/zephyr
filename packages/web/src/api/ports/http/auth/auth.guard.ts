/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CanActivate, ExecutionContext, FactoryProvider, Inject, Injectable, InternalServerErrorException, Scope, UnauthorizedException, createParamDecorator } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { unsafeGlobalScopeRun } from '@zephyr/kit/effection/global-scope.js'

@Injectable()
export class AuthGuard implements CanActivate {
  @Inject()
  private readonly authService!: AuthService

  public canActivate(context: ExecutionContext) {
    return unsafeGlobalScopeRun(function* (this: AuthGuard) {
      const request = context.switchToHttp().getRequest<Request>()
      const token = this.extractToken(request)

      if (undefined === token) {
        return false
      }

      try {
        const data = yield* this.authService.authenticate(token)

        if (null === data) {
          throw new UnauthorizedException()
        }

        ;(request as any)[passport] = data

        return true
      }
      catch {
        return false
      }
    }.bind(this))
  }

  private extractToken(request: Request) {
    return request.headers.authorization?.match(/^\s*bearer\s+(?<token>\S+)\s*$/i)?.groups?.['token']
  }
}

export abstract class Passport {
  public abstract readonly id: number
}

export namespace Passport{
  export const provider: FactoryProvider = {
    inject: [REQUEST],
    provide: Passport,
    scope: Scope.REQUEST,
    useFactory(request: Request) {
      const value = (request as any)[passport]

      if (undefined === value) {
        throw new InternalServerErrorException()
      }

      return value
    },
  }

  export const param = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest()
      const result = (request)[passport]

      if (undefined === result) {
        throw new InternalServerErrorException()
      }

      return result
    },
  )()
}

const passport = Symbol('passport')
