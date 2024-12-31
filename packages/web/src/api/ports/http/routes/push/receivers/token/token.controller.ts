import { ApiParam, ApiTags } from '@nestjs/swagger'
import { Controller, Inject, NotFoundException, Sse } from '@nestjs/common'
import { Observable, concatMap, from, map } from 'rxjs'
import { PushService } from '../../../../../../../domains/push/push.service.js'
import { ReceiverService } from '../../../../../../../domains/push/receiver.service.js'
import { unsafeGlobalScopeRun } from '../../../../../../../kits/effection/global-scope.js'
import { urlPattern } from '../../../../kits/url-pattern.js'

export const tokenPath = urlPattern.path('token')

@ApiParam({
  name: tokenPath.name,
  type: String,
})
@ApiTags(`push/receivers/${tokenPath.pattern}`)
@Controller(tokenPath.pattern)
export class TokenController {
  @Inject()
  private readonly pushService!: PushService

  @Inject()
  private readonly receiverService!: ReceiverService

  @Inject(tokenPath)
  private readonly token!: string

  @Sse()
  public [`@Sse()`](): Observable<string> {
    return from(
      unsafeGlobalScopeRun(function*(this: TokenController) {
        const receiver = yield * this.pushService.getReceiver(this.token)

        if (null === receiver) {
          throw new NotFoundException()
        }

        return this.receiverService.put(receiver).shared
      }.bind(this)),
    ).pipe(
      concatMap(x => x),
      map(x => JSON.stringify(x)),
    )
  }
}
