import { Controller, Inject, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PushService } from '../../../../../domains/push/push.service.js'

@ApiTags('push')
@Controller('push')
export class PushController {
  @Inject()
  private readonly pushService!: PushService

  @Post('receiver')
  public [`@Post('receiver')`]() {
    void this.pushService
  }
}
