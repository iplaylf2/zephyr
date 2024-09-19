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
  @Delete('chatrooms/data')
  public async [`@Delete('chatrooms/data')`](@Body() body: member.DeleteDataRecordDto) {
    await globalScope.run(() =>
      this.conversationService.deleteData(this.passport.id, body),
    )
  }

  @ApiOkResponse({
    isArray: true,
    type: member.ChatroomDto,
  })
  @Get('chatrooms')
  public [`@Get('chatrooms')`](): Promise<readonly member.ChatroomDto[]> {
    return globalScope.run(() =>
      this.conversationService.getConversationsRecord(this.passport.id),
    )
  }

  @ApiOkResponse({
    type: member.DataRecordDto,
  })
  @Get('chatrooms/data')
  public [`@Get('chatrooms/data')`](): Promise<member.DataRecordDto> {
    return globalScope.run(() =>
      this.conversationService.getData(this.passport.id),
    )
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('chatrooms/data')
  public async [`@Put('chatrooms/data')`](@Body() dataRecord: member.DataRecordDto) {
    await globalScope.run(() =>
      this.conversationService.patchData(this.passport.id, dataRecord),
    )
  }
}
