import { ApiParam, ApiTags } from '@nestjs/swagger'
import { Controller, Delete, Get, Inject, Patch } from '@nestjs/common'
import { Passport } from '../../../../../../auth/auth.guard.js'
import { PushService } from '../../../../../../../../../domains/push/push.service.js'
import { RequirePassport } from '../../../../../../decorators/require-passport.decorator.js'
import { urlPattern } from '../../../../../../kits/url-pattern.js'

export const typePath = urlPattern.path('type')

@ApiParam({
  name: typePath.name,
  type: String,
})
@ApiTags('push/claimer/receiver/pushes/:type')
@RequirePassport()
@Controller(typePath.pattern)
export class TypeController {
  @Inject()
  private readonly passport!: Passport

  @Inject()
  private readonly pushService!: PushService

  @Inject(typePath)
  private readonly type!: string

  @Delete()
  public [`@Delete()`]() {
    void this.passport
    void this.pushService
    void this.type
  }

  @Get()
  public [`@Get()`]() {}

  @Patch()
  public [`@Patch()`]() {}
}
