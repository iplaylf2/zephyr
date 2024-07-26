import { Controller, Delete, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { RequirePassport } from '../../decorators/require-passport.decorator.js'

@ApiTags('conversations')
@RequirePassport()
@Controller('conversations')
export class ConversationsController {
  @Delete('unread')
  public [`@Delete('unread')`]() {
  }

  @Get('unread')
  public [`@Get('unread')`]() {
  }

  @Get()
  public [`@Get()`]() {
  }
}
