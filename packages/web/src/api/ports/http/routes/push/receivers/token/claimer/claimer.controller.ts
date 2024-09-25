import { ApiParam, ApiTags } from '@nestjs/swagger'
import { Controller, Delete, Inject, Put } from '@nestjs/common'
import { Passport } from '../../../../../auth/auth.guard.js'
import { RequirePassport } from '../../../../../decorators/require-passport.decorator.js'
import { path } from '../../../../../pattern.js'

@ApiParam({
  name: path.token.name,
  type: String,
})
@ApiTags(`push/receivers/${path.token.pattern}/claimer`)
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
