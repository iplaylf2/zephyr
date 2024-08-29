import { Controller, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { RequirePassport } from '../../decorators/require-passport.decorator.js'

@ApiTags('dialogue')
@RequirePassport()
@Controller('dialogue')
export class DialogueController {
  @Put()
  public [`@Put()`]() {
  }
}
