import { ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common'
import { Passport } from '../../../auth/auth.guard.js'
import { RequirePassport } from '../../../decorators/require-passport.decorator.js'
import { conversation } from '../../../../../../domains/conversation/dialogue/dialogue.service.js'
import { globalScope } from '../../../../../../kits/effection/global-scope.js'
import { id } from './id.dto.js'
import { urlPattern } from '../../../kits/url-pattern.js'

export const idPath = urlPattern.path('id', Number)

@ApiParam({
  name: idPath.name,
  type: Number,
})
@ApiTags(`dialogues/${idPath.pattern}`)
@RequirePassport()
@Controller(idPath.pattern)
export class IdController {
  @Inject()
  private readonly conversationService!: conversation.DialogueService

  @Inject(idPath)
  private readonly id!: number

  @Inject()
  private readonly passport!: Passport

  @ApiOkResponse({
    isArray: true,
    type: id.MessageDto,
  })
  @Get('messages')
  public [`@Get('messages')`](@Query() query: id.MessageQueryDto): Promise<readonly id.MessageDto[]> {
    return globalScope.run(() =>
      this.conversationService.rangeMessages(this.id, query.start ?? '-', query.end ?? '+'),
    )
  }

  @ApiCreatedResponse({
    schema: {
      description: 'message id',
      nullable: true,
      type: 'string',
    },
  })
  @Post('message')
  public [`@Post('message')`](
    @Body() body: id.MessageBodyDto,
  ): Promise<string | null> {
    return globalScope.run(() =>
      this.conversationService.userPost(this.id, this.passport.id, body),
    )
  }
}
