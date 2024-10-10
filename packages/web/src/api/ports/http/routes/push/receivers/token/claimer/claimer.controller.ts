import { ApiParam, ApiTags } from '@nestjs/swagger'
import { Controller, Inject, NotFoundException, Put } from '@nestjs/common'
import { Passport } from '../../../../../auth/auth.guard.js'
import { PushService } from '../../../../../../../../domains/push/push.service.js'
import { RequirePassport } from '../../../../../decorators/require-passport.decorator.js'
import { globalScope } from '../../../../../../../../kits/effection/global-scope.js'
import { path } from '../../../../../pattern.js'

@ApiParam({
  name: path.token.name,
  type: String,
})
@ApiTags(`push/receivers/${path.token.pattern}/claimer`)
@RequirePassport()
@Controller('claimer')
export class ClaimerController {
  @Inject()
  private readonly passport!: Passport

  @Inject()
  private readonly pushService!: PushService

  @Inject(path.token)
  private readonly token!: string

  @Put()
  public [`@Put()`]() {
    return globalScope.run(function*(this: ClaimerController) {
      const receiver = yield * this.pushService.getReceiver(this.token)

      if (null === receiver) {
        throw new NotFoundException()
      }

      yield * this.pushService.active([receiver])
      yield * this.pushService.putClaimer(receiver, this.passport.id)
    }.bind(this))
  }
}
