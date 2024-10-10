import { ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Inject, NotFoundException, Patch } from '@nestjs/common'
import { Passport } from '../../../../../../auth/auth.guard.js'
import { PushService } from '../../../../../../../../../domains/push/push.service.js'
import { RequirePassport } from '../../../../../../decorators/require-passport.decorator.js'
import { either } from 'fp-ts'
import { globalScope } from '../../../../../../../../../kits/effection/global-scope.js'
import { type } from './type.dto.js'
import { urlPattern } from '../../../../../../kits/url-pattern.js'

export const typePath = urlPattern.path('type')

@ApiParam({
  name: typePath.name,
  type: String,
})
@ApiTags(`push/claimer/receiver/pushes/${typePath.pattern}`)
@RequirePassport()
@Controller(typePath.pattern)
export class TypeController {
  @Inject()
  private readonly passport!: Passport

  @Inject()
  private readonly pushService!: PushService

  @Inject(typePath)
  private readonly type!: string

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete()
  public [`@Delete()`](@Body() pushes: type.PushesDto): Promise<void> {
    return globalScope.run(function*(this: TypeController) {
      const receiver = yield * this.pushService.getReceiver(this.passport.id)

      if (null === receiver) {
        throw new NotFoundException()
      }

      yield * this.pushService.deleteSubscriptions(receiver, this.type, pushes)
    }.bind(this))
  }

  @ApiOkResponse({
    isArray: true,
    type: Number,
  })
  @Get()
  public [`@Get()`](): Promise<readonly number[]> {
    return globalScope.run(function*(this: TypeController) {
      const receiver = yield * this.pushService.getReceiver(this.passport.id)

      if (null === receiver) {
        throw new NotFoundException()
      }

      return yield * this.pushService.getSubscriptions(receiver, this.type)
    }.bind(this))
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch()
  public [`@Patch()`](@Body() pushes: type.PushesDto): Promise<void> {
    return globalScope.run(function*(this: TypeController) {
      const receiver = yield * this.pushService.getReceiver(this.passport.id)

      if (null === receiver) {
        throw new NotFoundException()
      }

      const reply = yield * this.pushService.patchSubscriptions(receiver, this.type, pushes)

      if (either.isLeft(reply)) {
        throw new ForbiddenException()
      }
    }.bind(this))
  }
}
