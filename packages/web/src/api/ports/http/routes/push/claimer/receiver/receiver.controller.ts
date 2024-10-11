import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Controller, Delete, Get, HttpCode, HttpStatus, Inject, Put, Sse } from '@nestjs/common'
import { Passport } from '../../../../auth/auth.guard.js'
import { PushService } from '../../../../../../../domains/push/push.service.js'
import { RequirePassport } from '../../../../decorators/require-passport.decorator.js'
import { cOperation } from '../../../../../../../common/fp-effection/c-operation.js'
import { globalScope } from '../../../../../../../kits/effection/global-scope.js'
import { pipe } from 'fp-ts/lib/function.js'

@ApiTags('push/claimer/receiver')
@RequirePassport()
@Controller('receiver')
export class ReceiverController {
  @Inject()
  private readonly passport!: Passport

  @Inject()
  private readonly pushService!: PushService

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete()
  public [`@Delete()`](): Promise<void> {
    return globalScope.run(function*(this: ReceiverController) {
      const receiver = yield * this.pushService.getClaimerReceiver(this.passport.id)

      if (null === receiver) {
        return
      }

      yield * this.pushService.deleteReceiver(receiver)
    }.bind(this))
  }

  @ApiOkResponse({
    schema: {
      nullable: true,
      type: 'string',
    },
  })
  @Get('token')
  public [`@Get('token')`](): Promise<string | null> {
    return globalScope.run(function*(this: ReceiverController) {
      const token = yield * this.pushService.getClaimerReceiverToken(this.passport.id)

      if (null === token) {
        return null
      }

      const receiver = yield * this.pushService.getReceiver(token)

      if (null === receiver) {
        return null
      }

      yield * this.pushService.active([receiver])

      return token
    }.bind(this))
  }

  @ApiOkResponse({
    type: String,
  })
  @Put()
  public [`@Put()`](): Promise<string> {
    return globalScope.run(pipe(
      () => this.pushService.putReceiver(this.passport.id),
      cOperation.map(x => x.token),
    ))
  }

  @Sse()
  public [`@Sse()`]() {}
}
