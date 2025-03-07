import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger'
import { Controller, Inject, Post } from '@nestjs/common'
import { PushService } from '../../../../../domains/push/push.service.js'
import { pipe } from 'fp-ts/lib/function.js'
import { plan } from '@zephyr/kit/fp-effection/plan.js'
import { unsafeGlobalScopeRun } from '@zephyr/kit/effection/global-scope.js'

@ApiTags('push')
@Controller('push')
export class PushController {
  @Inject()
  private readonly pushService!: PushService

  @ApiCreatedResponse({
    type: String,
  })
  @Post('receiver')
  public [`@Post('receiver')`](): Promise<string> {
    return unsafeGlobalScopeRun(pipe(
      () => this.pushService.postReceiver(null),
      plan.map(x => x.token),
    ))
  }
}
