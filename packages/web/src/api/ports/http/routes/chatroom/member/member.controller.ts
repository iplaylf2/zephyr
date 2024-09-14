import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Put } from '@nestjs/common'
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

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('chatrooms/progress')
  public async [`@Delete('chatrooms/progress')`](@Body() body: member.ConversationsDto) {
    await globalScope.run(() =>
      this.conversationService.clearProgress(this.passport.id, body),
    )
  }

  @ApiOkResponse({
    isArray: true,
    type: member.ChatroomDto,
  })
  @Get('chatrooms')
  public [`@Get('chatrooms')`](): Promise<readonly member.ChatroomDto[]> {
    return globalScope.run(() =>
      this.conversationService.fetchConversationsRecord(this.passport.id),
    )
  }

  @ApiOkResponse({
    type: member.ProgressRecordDto,
  })
  @Get('chatrooms/progress')
  public [`@Get('chatrooms/progress')`](): Promise<member.ProgressRecordDto> {
    return globalScope.run(() =>
      this.conversationService.getProgress(this.passport.id),
    )
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('chatrooms/progress')
  public async [`@Put('chatrooms/progress')`](@Body() progressRecord: member.ProgressRecordDto) {
    await globalScope.run(() =>
      this.conversationService.patchData(this.passport.id, progressRecord),
    )
  }
}
