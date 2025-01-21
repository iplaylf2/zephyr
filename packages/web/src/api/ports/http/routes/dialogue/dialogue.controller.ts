import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Inject, Put } from '@nestjs/common'
import { Passport } from '../../auth/auth.guard.js'
import { RequirePassport } from '../../decorators/require-passport.decorator.js'
import { cOperation } from '../../../../../common/fp-effection/c-operation.js'
import { conversation } from '../../../../../domains/conversation/conversation.js'
import { dialogue } from './dialogue.dto.js'
import { pipe } from 'fp-ts/lib/function.js'
import { unsafeGlobalScopeRun } from '../../../../../kits/effection/global-scope.js'

@ApiTags('dialogue')
@RequirePassport()
@Controller('dialogue')
export class DialogueController {
  @Inject()
  private readonly conversationService!: conversation.DialogueService

  @Inject()
  private readonly passport!: Passport

  @ApiOkResponse({
    description: 'dialogue id',
    type: Number,
  })
  @Put()
  public [`@Put()`](@Body() creation: dialogue.CreationDto): Promise<number> {
    return unsafeGlobalScopeRun(pipe(
      () => this.conversationService.putDialogue(this.passport.id, creation.participantId),
      cOperation.map(x => x.conversationId),
    ))
  }
}
