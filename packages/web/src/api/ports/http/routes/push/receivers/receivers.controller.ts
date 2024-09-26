import { ApiParam, ApiTags } from '@nestjs/swagger'
import { Controller, Delete, Get, Inject, Patch, Sse } from '@nestjs/common'
import { urlPattern } from '../../../kits/url-pattern.js'

export const tokenPath = urlPattern.path('token')

@ApiParam({
  name: tokenPath.name,
  type: String,
})
@ApiTags(`push/receivers/${tokenPath.pattern}`)
@Controller(tokenPath.pattern)
export class ReceiversController {
  @Inject(tokenPath)
  private readonly token!: string

  @Delete('pushes')
  public [`@Delete('pushes')`]() {
    void this.token
  }

  @Get('pushes')
  public [`@Get('pushes')`]() {}

  @Patch('pushes')
  public [`@Patch('pushes')`]() {}

  @Sse()
  public [`@Sse()`]() {}
}
