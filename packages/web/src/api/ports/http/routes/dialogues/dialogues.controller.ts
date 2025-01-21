import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Patch } from '@nestjs/common'
import { Passport } from '../../auth/auth.guard.js'
import { RequirePassport } from '../../decorators/require-passport.decorator.js'
import { conversation } from '../../../../../domains/conversation/conversation.js'
import { dialogues } from './dialogues.dto.js'
import { unsafeGlobalScopeRun } from '../../../../../kits/effection/global-scope.js'

@ApiTags('dialogues')
@RequirePassport()
@Controller('dialogues')
export class DialoguesController {
  @Inject()
  private readonly conversationService!: conversation.DialogueService

  @Inject()
  private readonly passport!: Passport

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('data')
  public async [`@Delete('data')`](@Body() body: dialogues.DeleteDataRecordDto) {
    await unsafeGlobalScopeRun(
      () => this.conversationService.deleteData(this.passport.id, body),
    )
  }

  @Get('data')
  public [`@Get('data')`](): Promise<dialogues.DataRecordDto> {
    return unsafeGlobalScopeRun(
      () => this.conversationService.getData(this.passport.id),
    )
  }

  @ApiOkResponse({
    isArray: true,
    type: dialogues.DialogueInfoDto,
  })
  @Get('info')
  public [`@Get('info')`](): Promise<readonly dialogues.DialogueInfoDto[]> {
    return unsafeGlobalScopeRun(
      () => this.conversationService.getConversationsRecord(this.passport.id),
    )
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('data')
  public async [`@Patch('data')`](@Body() dataRecord: dialogues.DataRecordDto) {
    await unsafeGlobalScopeRun(
      () => this.conversationService.patchData(this.passport.id, dataRecord),
    )
  }
}
