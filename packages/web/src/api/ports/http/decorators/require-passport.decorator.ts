import { CanActivate, UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth } from '@nestjs/swagger'
import { AuthGuard } from '../auth/auth.guard.js'
import defaults from 'defaults'

export function RequirePassport(
  options?: {
    decorators?: ReadonlyArray<ClassDecorator | MethodDecorator | PropertyDecorator>
    guards?: ReadonlyArray<CanActivate | NewableFunction>
  },
) {
  const _options = defaults(options ?? {}, { decorators: [], guards: [] })

  return applyDecorators(
    UseGuards(AuthGuard, ..._options.guards),
    ApiBearerAuth(),
    ..._options.decorators,
  )
}
