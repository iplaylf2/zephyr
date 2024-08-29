import { Controller, Get, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { RequirePassport } from '../../../decorators/require-passport.decorator.js'

@ApiTags('chatroom')
@RequirePassport()
@Controller('member')
export class MemberController {
  @Get('chatrooms')
  public [`@Get('chatrooms')`]() {
  }

  @Get('chatrooms/progress')
  public [`@Get('chatrooms/progress')`]() {
  }

  @Put('chatrooms/progress')
  public [`@Put('chatrooms/progress')`]() {
  }
}
