import { ApiParam, ApiTags } from '@nestjs/swagger'
import { Controller, Inject, Sse } from '@nestjs/common'
import { EMPTY, Observable, concatMap, from, isObservable, map } from 'rxjs'
import { flow, pipe } from 'fp-ts/lib/function.js'
import { identity, ioOption, option } from 'fp-ts'
import { PushService } from '../../../../../../../domains/push/push.service.js'
import { ReceiverService } from '../../../../../../../domains/push/receiver.service.js'
import { cOperation } from '../../../../../../../common/fp-effection/c-operation.js'
import { globalScope } from '../../../../../../../kits/effection/global-scope.js'
import { push } from '../../../../../../../models/push.js'
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
    return from(globalScope.run(pipe(
      () => this.pushService.getReceiver(this.token),
      cOperation.chain(flow(
        option.fromNullable,
        option.map(
          x => () => this.receiverService.put(x).shared,
        ),
        ioOption.fromOption,
        ioOption.chainIOK(identity.of),
        ioOption.getOrElse<Observable<push.Message>>(() =>
          () => EMPTY,
        ),
        cOperation.FromIO.fromIO,
      )),
    ))).pipe(
      concatMap(x => isObservable(x) ? x : EMPTY),
      map(x => JSON.stringify(x)),
    )
  }
}
