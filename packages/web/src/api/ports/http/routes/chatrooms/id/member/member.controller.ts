import { ApiResponse, ApiTags } from '@nestjs/swagger'
import { Controller, Delete, Inject, NotFoundException, Put } from '@nestjs/common'
import { Passport } from '../../../../auth/auth.guard.js'
import { RequirePassport } from '../../../../decorators/require-passport.decorator.js'
import { cOperation } from '../../../../../../../common/fp-effection/c-operation.js'
import { conversation } from '../../../../../../../domains/conversation/group/group.service.js'
import { globalScope } from '../../../../../../../kits/effection/global-scope.js'
import { path } from '../../../../pattern.js'
import { pipe } from 'fp-ts/lib/function.js'

@ApiTags('chatrooms/:id/member')
@RequirePassport()
@Controller('member')
export class MemberController {
  @Inject(path.chatroom)
  private readonly chatroom!: number

  @Inject()
  private readonly conversationService!: conversation.GroupService

  @Inject()
  private readonly passport!: Passport

  @ApiResponse({
    description: 'ok',
    type: Boolean,
  })
  @Delete()
  public [`@Delete()`](): Promise<boolean> {
    return globalScope.run(pipe(
      () => this.check(),
      cOperation.chain(() =>
        () => this.conversationService.deleteParticipants(this.chatroom, [this.passport.id]),
      ),
      cOperation.map(x => 0 < x.length),
    ))
  }

  @ApiResponse({
    description: 'ok',
    type: Boolean,
  })
  @Put()
  public [`@Put()`](): Promise<boolean> {
    return globalScope.run(pipe(
      () => this.check(),
      cOperation.chain(() =>
        () => this.conversationService.putParticipants(this.chatroom, [this.passport.id]),
      ),
      cOperation.map(x => 0 < x.length),
    ))
  }

  private *check() {
    const exists = yield * this.conversationService.active([this.chatroom])

    if (0 === exists.length) {
      throw new NotFoundException()
    }
  }
}
