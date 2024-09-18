import { ApiResponse, ApiTags } from '@nestjs/swagger'
import { Controller, Delete, Inject, NotFoundException, Put } from '@nestjs/common'
import { Passport } from '../../../../auth/auth.guard.js'
import { RequirePassport } from '../../../../decorators/require-passport.decorator.js'
import { conversation } from '../../../../../../../domains/conversation/group/group.service.js'
import { globalScope } from '../../../../../../../kits/effection/global-scope.js'
import { path } from '../../../../pattern.js'
import { spawn } from 'effection'

@ApiTags('chatrooms')
@RequirePassport()
@Controller('member')
export class MemberController {
  @Inject(path.chatroom)
  private readonly chatroom!: string

  @Inject()
  private readonly conversationService!: conversation.GroupService

  @Inject()
  private readonly passport!: Passport

  @ApiResponse({
    description: 'ok',
    type: Boolean,
  })
  @Delete()
  public [`@Delete()`]() {
    return globalScope.run(function*(this: MemberController) {
      yield * this.checkAndExpire()

      return yield * this.conversationService.deleteParticipants(this.chatroom, [this.passport.id])
    }.bind(this))
  }

  @ApiResponse({
    description: 'ok',
    type: Boolean,
  })
  @Put()
  public [`@Put()`]() {
    return globalScope.run(function*(this: MemberController) {
      yield * this.checkAndExpire()

      return yield * this.conversationService.postParticipants(this.chatroom, [this.passport.id])
    }.bind(this))
  }

  private *checkAndExpire() {
    void (yield * spawn(() => this.conversationService.expire([this.chatroom])))

    const exists = yield * this.conversationService.exists([this.chatroom])

    if (0 === exists.length) {
      throw new NotFoundException()
    }
  }
}
