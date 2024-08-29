import { Controller, Get, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { RequirePassport } from '../../decorators/require-passport.decorator.js'

@ApiTags('dialogues')
@RequirePassport()
@Controller('dialogues')
export class DialoguesController {
  @Get('progress')
  public [`@Get('progress')`]() {
  }

  @Get()
  public [`@Get()`]() {
  }

  @Put('progress')
  public [`@Put('progress')`]() {
  }
}
