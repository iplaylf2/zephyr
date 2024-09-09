import { ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Get, Inject, NotFoundException, Post, Query } from '@nestjs/common'
import { Passport } from '../../../auth/auth.guard.js'
import { RequirePassport } from '../../../decorators/require-passport.decorator.js'
import { conversation } from '../../../../../../domains/conversation/group/group.service.js'
import { globalScope } from '../../../../../../kits/effection/global-scope.js'
import { id } from './id.dto.js'
import { spawn } from 'effection'
import { urlPattern } from '../../../kits/url-pattern.js'

export const idPath = urlPattern.path('id')

@ApiParam({
  name: idPath.name,
  type: String,
})
@ApiTags('chatrooms')
@Controller(idPath.pattern)
export class IdController {
  @Inject()
  private readonly conversationService!: conversation.GroupService

  @Inject(idPath)
  private readonly id!: string

  @ApiOkResponse({
    description: 'user id of members',
    isArray: true,
    type: String,
  })
  @Get('members')
  public [`@Get('members')`]() {
    return globalScope.run(function*(this: IdController) {
      yield * this.checkAndExpire()

      return yield * this.conversationService.fetchParticipants(this.id)
    }.bind(this))
  }

  @ApiOkResponse({
    isArray: true,
    type: id.MessageDto,
  })
  @Get('messages')
  public [`@Get('messages')`](@Query() query: id.MessageQueryDto): Promise<readonly id.MessageDto[]> {
    return globalScope.run(function*(this: IdController) {
      yield * this.checkAndExpire()

      return yield * this.conversationService.rangeMessages(this.id, query.start ?? '-', query.end ?? '+')
    }.bind(this))
  }

  @ApiCreatedResponse({
    schema: {
      description: 'message id',
      nullable: true,
      type: 'string',
    },
  })
  @RequirePassport()
  @Post('message')
  public [`@Post('message')`](@Passport.param passport: Passport, @Body() body: id.MessageBodyDto) {
    return globalScope.run(function*(this: IdController) {
      yield * this.checkAndExpire()

      return yield * this.conversationService.userPost(this.id, passport.id, body)
    }.bind(this))
  }

  private *checkAndExpire() {
    void (yield * spawn(() => this.conversationService.expire([this.id])))

    const exists = yield * this.conversationService.exists([this.id])

    if (0 === exists.length) {
      throw new NotFoundException()
    }
  }
}
