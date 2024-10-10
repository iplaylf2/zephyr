import { Controller, Delete, Get, Inject, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Passport } from '../../../../auth/auth.guard.js'
import { PushService } from '../../../../../../../domains/push/push.service.js'
import { RequirePassport } from '../../../../decorators/require-passport.decorator.js'

@ApiTags('push/claimer/receiver')
@RequirePassport()
@Controller('receiver')
export class ReceiverController {
  @Inject()
  private readonly passport!: Passport

  @Inject()
  private readonly pushService!: PushService

  @Delete()
  public [`@Delete()`]() {
    void this.passport
    void this.pushService
  }

  @Get('token')
  public [`@Get('token')`]() {}

  @Put()
  public [`@Put()`]() {}
}
