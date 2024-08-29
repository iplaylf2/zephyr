import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Controller, Get, Inject, Put } from '@nestjs/common'
import { Passport } from '../../../auth/auth.guard.js'
import { RequirePassport } from '../../../decorators/require-passport.decorator.js'
import { conversation } from '../../../../../../domains/conversation/group/group.service.js'
import { globalScope } from '../../../../../../kits/effection/global-scope.js'
import { member } from './member.dto.js'

@ApiTags('chatroom')
@RequirePassport()
@Controller('member')
export class MemberController {
  @Inject()
  private readonly conversationService!: conversation.GroupService

  @Inject()
  private readonly passport!: Passport

  @ApiOkResponse({
    isArray: true,
    type: member.ChatroomDto,
  })
  @Get('chatrooms')
  public [`@Get('chatrooms')`](): Promise<readonly member.ChatroomDto[]> {
    return globalScope.run(
      () => this.conversationService.fetchConversationsRecord(this.passport.id),
    )
  }

  @Get('chatrooms/progress')
  public [`@Get('chatrooms/progress')`]() {
  }

  @Put('chatrooms/progress')
  public [`@Put('chatrooms/progress')`]() {
  }
}
