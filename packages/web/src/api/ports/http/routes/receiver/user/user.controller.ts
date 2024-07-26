import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { RequirePassport } from '../../../decorators/require-passport.decorator.js'

@ApiTags('receiver')
@RequirePassport()
@Controller('user')
export class UserController {
  @Get('subscriptions')
  public [`@Get('subscriptions')`]() {
  }
}
