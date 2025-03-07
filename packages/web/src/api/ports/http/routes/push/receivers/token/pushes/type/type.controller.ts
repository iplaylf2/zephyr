import { ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Inject, NotFoundException, Patch } from '@nestjs/common'
import { PushService } from '../../../../../../../../../domains/push/push.service.js'
import { either } from 'fp-ts'
import { path } from '../../../../../../pattern.js'
import { type } from './type.dto.js'
import { unsafeGlobalScopeRun } from '@zephyr/kit/effection/global-scope.js'
import { urlPattern } from '../../../../../../kits/url-pattern.js'

export const typePath = urlPattern.path('type')

@ApiParam({
  name: typePath.name,
  type: String,
})
@ApiParam({
  name: path.token.name,
  type: String,
})
@ApiTags(`push/receivers/${path.token.pattern}/pushes/${typePath.pattern}`)
@Controller(typePath.pattern)
export class TypeController {
  @Inject()
  private readonly pushService!: PushService

  @Inject(path.token)
  private readonly token!: string

  @Inject(typePath)
  private readonly type!: string

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete()
  public [`@Delete()`](@Body() pushes: type.PushesDto): Promise<void> {
    return unsafeGlobalScopeRun(function* (this: TypeController) {
      const receiver = yield* this.pushService.getReceiver(this.token)

      if (null === receiver) {
        throw new NotFoundException()
      }

      yield* this.pushService.active([receiver])

      yield* this.pushService.deleteSubscriptions(receiver, this.type, pushes)
    }.bind(this),
    )
  }

  @ApiOkResponse({
    isArray: true,
    type: Number,
  })
  @Get()
  public [`@Get()`](): Promise<readonly number[]> {
    return unsafeGlobalScopeRun(function* (this: TypeController) {
      const receiver = yield* this.pushService.getReceiver(this.token)

      if (null === receiver) {
        throw new NotFoundException()
      }

      yield* this.pushService.active([receiver])

      return yield* this.pushService.getSubscriptions(receiver, this.type)
    }.bind(this),
    )
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch()
  public [`@Patch()`](@Body() pushes: type.PushesDto): Promise<void> {
    return unsafeGlobalScopeRun(function* (this: TypeController) {
      const receiver = yield* this.pushService.getReceiver(this.token)

      if (null === receiver) {
        throw new NotFoundException()
      }

      yield* this.pushService.active([receiver])

      const reply = yield* this.pushService.patchSubscriptions(receiver, this.type, pushes)

      if (either.isLeft(reply)) {
        throw new ForbiddenException()
      }
    }.bind(this),
    )
  }
}
