import { ApiParam, ApiTags } from '@nestjs/swagger'
import { Controller, Delete, Get, Inject, Patch } from '@nestjs/common'
import { Passport } from '../../../../../../auth/auth.guard.js'
import { RequirePassport } from '../../../../../../decorators/require-passport.decorator.js'
import { path } from '../../../../../../pattern.js'
import { urlPattern } from '../../../../../../kits/url-pattern.js'

export const typePath = urlPattern.path('type')

@ApiParam({
  name: typePath.name,
  type: String,
})
@ApiParam({
  name: path.token.name,
  type: String,
})
@ApiTags(`push/receivers/${path.token.pattern}/pushes/${typePath.pattern}`)
@RequirePassport()
@Controller(typePath.pattern)
export class TypeController {
  @Inject()
  private readonly passport!: Passport

  @Inject(path.token)
  private readonly token!: string

  @Inject(typePath)
  private readonly type!: string

  @Delete()
  public [`@Delete()`]() {
    void this.passport
    void this.token
    void this.type
  }

  @Get()
  public [`@Get()`]() {}

  @Patch()
  public [`@Patch()`]() {}
}
