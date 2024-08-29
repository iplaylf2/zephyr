import { ApiParam, ApiTags } from '@nestjs/swagger'
import { Controller, Get, Inject, Post } from '@nestjs/common'
import { RequirePassport } from '../../../decorators/require-passport.decorator.js'
import { urlPattern } from '../../../kits/url-pattern.js'

export const idPath = urlPattern.path('id')

@ApiParam({
  name: idPath.name,
  type: String,
})
@ApiTags('dialogues')
@RequirePassport()
@Controller(idPath.pattern)
export class IdController {
  @Inject(idPath)
  private readonly id!: string

  @Get('messages')
  public [`@Get('messages')`]() {
    void this.id
  }

  @Post('message')
  public [`@Post('message')`]() {
  }
}
