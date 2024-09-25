import { Controller, Delete, Get, Inject, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Passport } from '../../../../auth/auth.guard.js'
import { RequirePassport } from '../../../../decorators/require-passport.decorator.js'

@ApiTags('push/claimer/receiver')
@RequirePassport()
@Controller('receiver')
export class ReceiverController {
  @Inject()
  private readonly passport!: Passport

  @Delete('pushes')
  public [`@Delete('pushes')`]() {
    void this.passport
  }

  @Get('pushes')
  public [`@Get('pushes')`]() {}

  @Get('token')
  public [`@Get('token')`]() {}

  @Put('pushes')
  public [`@Put('pushes')`]() {}
}
