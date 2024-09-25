import { Controller, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('push')
@Controller('push')
export class PushController {
  @Post('receiver')
  public [`@Post('receiver')`]() {}
}
