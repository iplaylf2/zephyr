import { ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Get, Inject, NotFoundException, Post, Query } from '@nestjs/common'
import { Passport } from '../../../auth/auth.guard.js'
import { RequirePassport } from '../../../decorators/require-passport.decorator.js'
import { cOperation } from '../../../../../../common/fp-effection/c-operation.js'
import { conversation } from '../../../../../../domains/conversation/conversation.js'
import { id } from './id.dto.js'
import { pipe } from 'fp-ts/lib/function.js'
import { unsafeGlobalScopeRun } from '../../../../../../kits/effection/global-scope.js'
import { urlPattern } from '../../../kits/url-pattern.js'

export const idPath = urlPattern.path('id', Number)

@ApiParam({
  name: idPath.name,
  type: Number,
})
@ApiTags(`groups/${idPath.pattern}`)
@Controller(idPath.pattern)
export class IdController {
  @Inject()
  private readonly conversationService!: conversation.GroupService

  @Inject(idPath)
  private readonly id!: number

  @ApiOkResponse({
    description: 'user id of members',
    isArray: true,
    type: Number,
  })
  @Get('members')
  public [`@Get('members')`](): Promise<readonly number[]> {
    return unsafeGlobalScopeRun(pipe(
      () => this.check(),
      cOperation.chain(
        () => () => this.conversationService.getParticipants(this.id),
      ),
    ))
  }

  @ApiOkResponse({
    isArray: true,
    type: id.MessageDto,
  })
  @Get('messages')
  public [`@Get('messages')`](@Query() query: id.MessageQueryDto): Promise<readonly id.MessageDto[]> {
    return unsafeGlobalScopeRun(pipe(
      () => this.check(),
      cOperation.chain(
        () => () => this.conversationService.rangeMessages(
          this.id,
          query.start ?? '-',
          query.end ?? '+',
        ),
      ),
    ))
  }

  @ApiCreatedResponse({
    schema: {
      description: 'message id',
      nullable: true,
      type: 'string',
    },
  })
  @RequirePassport()
  @Post('message')
  public [`@Post('message')`](
    @Passport.param passport: Passport,
    @Body() body: id.MessageBodyDto,
  ): Promise<string | null> {
    return unsafeGlobalScopeRun(pipe(
      () => this.check(),
      cOperation.chain(
        () => () => this.conversationService.userPost(this.id, passport.id, body),
      ),
    ))
  }

  private *check() {
    const exists = yield * this.conversationService.active([this.id])

    if (0 === exists.length) {
      throw new NotFoundException()
    }
  }
}
