import { ApiParam, ApiTags } from '@nestjs/swagger'
import { Controller, Inject, Sse } from '@nestjs/common'
import { urlPattern } from '../../../../kits/url-pattern.js'

export const tokenPath = urlPattern.path('token')

@ApiParam({
  name: tokenPath.name,
  type: String,
})
@ApiTags(`push/receivers/${tokenPath.pattern}`)
@Controller(tokenPath.pattern)
export class TokenController {
  @Inject(tokenPath)
  private readonly token!: string

  @Sse()
  public [`@Sse()`]() {
    void this.token
  }
}
