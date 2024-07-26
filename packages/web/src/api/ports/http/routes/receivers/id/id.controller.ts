import { ApiParam, ApiTags } from '@nestjs/swagger'
import { Controller, Inject, Sse } from '@nestjs/common'
import { ReceiverService } from '../../../../../../domains/receiver/receiver.service.js'
import { urlPattern } from '../../../kits/url-pattern.js'

export const idPath = urlPattern.path('id')

@ApiParam({
  name: idPath.name,
  type: String,
})
@ApiTags('receivers')
@Controller(idPath.pattern)
export class IdController {
  @Inject(idPath)
  private readonly id!: string

  @Inject()
  private readonly receiverService!: ReceiverService

  @Sse()
  public [`@Sse()`]() {
    void (this.id, this.receiverService)
  }
}
