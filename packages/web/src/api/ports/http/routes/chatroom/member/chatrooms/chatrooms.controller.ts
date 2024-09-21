import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Put } from '@nestjs/common'
import { Passport } from '../../../../auth/auth.guard.js'
import { RequirePassport } from '../../../../decorators/require-passport.decorator.js'
import { chatrooms } from './chatrooms.dto.js'
import { conversation } from '../../../../../../../domains/conversation/group/group.service.js'
import { globalScope } from '../../../../../../../kits/effection/global-scope.js'

@ApiTags('chatroom')
@RequirePassport()
@Controller('chatrooms')
export class ChatroomsController {
  @Inject()
  private readonly conversationService!: conversation.GroupService

  @Inject()
  private readonly passport!: Passport

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('data')
  public async [`@Delete('data')`](@Body() body: chatrooms.DeleteDataRecordDto) {
    await globalScope.run(() =>
      this.conversationService.deleteData(this.passport.id, body),
    )
  }

  @ApiOkResponse({
    type: chatrooms.DataRecordDto,
  })
  @Get('data')
  public [`@Get('data')`](): Promise<chatrooms.DataRecordDto> {
    return globalScope.run(() =>
      this.conversationService.getData(this.passport.id),
    )
  }

  @ApiOkResponse({
    isArray: true,
    type: chatrooms.ChatroomDto,
  })
  @Get()
  public [`@Get()`](): Promise<readonly chatrooms.ChatroomDto[]> {
    return globalScope.run(() =>
      this.conversationService.getConversationsRecord(this.passport.id),
    )
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('data')
  public async [`@Put('data')`](@Body() dataRecord: chatrooms.DataRecordDto) {
    await globalScope.run(() =>
      this.conversationService.patchData(this.passport.id, dataRecord),
    )
  }
}
