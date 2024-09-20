import { Controller, Inject, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Passport } from '../../auth/auth.guard.js'
import { RequirePassport } from '../../decorators/require-passport.decorator.js'
import { conversation } from '../../../../../domains/conversation/dialogue/dialogue.service.js'

@ApiTags('dialogue')
@RequirePassport()
@Controller('dialogue')
export class DialogueController {
  @Inject()
  private readonly conversationService!: conversation.DialogueService

  @Inject()
  private readonly passport!: Passport

  @Put()
  public [`@Put()`]() {
    void (this.conversationService, this.passport)
  }
}
