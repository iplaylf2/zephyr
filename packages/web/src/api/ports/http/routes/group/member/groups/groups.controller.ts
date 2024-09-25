import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Put } from '@nestjs/common'
import { Passport } from '../../../../auth/auth.guard.js'
import { RequirePassport } from '../../../../decorators/require-passport.decorator.js'
import { conversation } from '../../../../../../../domains/conversation/group/group.service.js'
import { globalScope } from '../../../../../../../kits/effection/global-scope.js'
import { groups } from './groups.dto.js'

@ApiTags('group/member/groups')
@RequirePassport()
@Controller('groups')
export class GroupsController {
  @Inject()
  private readonly conversationService!: conversation.GroupService

  @Inject()
  private readonly passport!: Passport

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('data')
  public async [`@Delete('data')`](@Body() body: groups.DeleteDataRecordDto) {
    await globalScope.run(() =>
      this.conversationService.deleteData(this.passport.id, body),
    )
  }

  @ApiOkResponse({
    type: groups.DataRecordDto,
  })
  @Get('data')
  public [`@Get('data')`](): Promise<groups.DataRecordDto> {
    return globalScope.run(() =>
      this.conversationService.getData(this.passport.id),
    )
  }

  @ApiOkResponse({
    isArray: true,
    type: groups.GroupInfoDto,
  })
  @Get('info')
  public [`@Get('info')`](): Promise<readonly groups.GroupInfoDto[]> {
    return globalScope.run(() =>
      this.conversationService.getConversationsRecord(this.passport.id),
    )
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('data')
  public async [`@Put('data')`](@Body() dataRecord: groups.DataRecordDto) {
    await globalScope.run(() =>
      this.conversationService.patchData(this.passport.id, dataRecord),
    )
  }
}
