import { Controller, Delete, Inject, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Passport } from '../../../../../auth/auth.guard.js'
import { RequirePassport } from '../../../../../decorators/require-passport.decorator.js'
import { path } from '../../../../../pattern.js'

@ApiTags('push/receivers/:token/claimer')
@RequirePassport()
@Controller('claimer')
export class ClaimerController {
  @Inject()
  private readonly passport!: Passport

  @Inject(path.token)
  private readonly token!: string

  @Delete()
  public [`@Delete()`]() {
    void this.passport
    void this.token
  }

  @Put()
  public [`@Put()`]() {}
}
