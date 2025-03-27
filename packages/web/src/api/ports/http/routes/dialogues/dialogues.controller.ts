import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common'
import { DialogueService } from '../../../../../domains/conversation/domains/dialogue/dialogue.service.js'
import { Passport } from '../../auth/auth.guard.js'
import { RequirePassport } from '../../decorators/require-passport.decorator.js'
import { dialogues } from './dialogues.dto.js'
import { unsafeGlobalScopeRun } from '@zephyr/kit/effection/global-scope.js'

@ApiTags('dialogues')
@RequirePassport()
@Controller('dialogues')
export class DialoguesController {
  @Inject()
  private readonly conversationService!: DialogueService

  @Inject()
  private readonly passport!: Passport

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('data')
  public async [`@Delete('data')`](@Body() body: dialogues.DeleteDataRecordDto) {
    await unsafeGlobalScopeRun(
      () => this.conversationService.deleteData(this.passport.id, body),
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
}
