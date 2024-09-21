import { Controller, Get, Inject, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Passport } from '../../auth/auth.guard.js'
import { RequirePassport } from '../../decorators/require-passport.decorator.js'
import { conversation } from '../../../../../domains/conversation/dialogue/dialogue.service.js'

@ApiTags('dialogues')
@RequirePassport()
@Controller('dialogues')
export class DialoguesController {
  @Inject()
  private readonly conversationService!: conversation.DialogueService

  @Inject()
  private readonly passport!: Passport

  @Get('data')
  public [`@Get('data')`]() {

  }

  @Get()
  public [`@Get()`]() {

  }

  @Put('data')
  public [`@Put('data')`]() {

  }
}
