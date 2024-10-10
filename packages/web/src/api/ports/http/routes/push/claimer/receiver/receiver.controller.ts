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

  @Delete()
  public [`@Delete()`]() {
    void this.passport
  }

  @Get('token')
  public [`@Get('token')`]() {}

  @Put()
  public [`@Put()`]() {}
}
