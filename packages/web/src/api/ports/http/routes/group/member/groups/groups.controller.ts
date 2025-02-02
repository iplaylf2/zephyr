import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Patch } from '@nestjs/common'
import { Passport } from '../../../../auth/auth.guard.js'
import { RequirePassport } from '../../../../decorators/require-passport.decorator.js'
import { conversation } from '../../../../../../../domains/conversation/conversation.js'
import { groups } from './groups.dto.js'
import { unsafeGlobalScopeRun } from '@zephyr/kit/effection/global-scope.js'

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
    await unsafeGlobalScopeRun(
      () => this.conversationService.deleteData(this.passport.id, body),
    )
  }

  @ApiOkResponse({
    type: groups.DataRecordDto,
  })
  @Get('data')
  public [`@Get('data')`](): Promise<groups.DataRecordDto> {
    return unsafeGlobalScopeRun(
      () => this.conversationService.getData(this.passport.id),
    )
  }

  @ApiOkResponse({
    isArray: true,
    type: groups.GroupInfoDto,
  })
  @Get('info')
  public [`@Get('info')`](): Promise<readonly groups.GroupInfoDto[]> {
    return unsafeGlobalScopeRun(
      () => this.conversationService.getConversationsRecord(this.passport.id),
    )
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('data')
  public async [`@Patch('data')`](@Body() dataRecord: groups.DataRecordDto) {
    await unsafeGlobalScopeRun(
      () => this.conversationService.patchData(this.passport.id, dataRecord),
    )
  }
}
