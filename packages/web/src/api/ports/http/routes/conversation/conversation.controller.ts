import { Controller, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { RequirePassport } from '../../decorators/require-passport.decorator.js'

@ApiTags('conversation')
@RequirePassport()
@Controller('conversation')
export class ConversationController {
  @Put()
  public [`@Put()`]() {
  }
}
