import { ApiResponse, ApiTags } from '@nestjs/swagger'
import { Controller, Delete, Inject, NotFoundException, Put } from '@nestjs/common'
import { Passport } from '../../../../auth/auth.guard.js'
import { RequirePassport } from '../../../../decorators/require-passport.decorator.js'
import { conversation } from '../../../../../../../domains/conversation/group/group.service.js'
import { globalScope } from '../../../../../../../kits/effection/global-scope.js'
import { path } from '../../../../pattern.js'

@ApiTags('chatrooms')
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
    return globalScope.run(function*(this: MemberController) {
      yield * this.checkAndExpire()

      const deleted = yield * this.conversationService.deleteParticipants(this.chatroom, [this.passport.id])

      return 0 < deleted.length
    }.bind(this))
  }

  @ApiResponse({
    description: 'ok',
    type: Boolean,
  })
  @Put()
  public [`@Put()`](): Promise<boolean> {
    return globalScope.run(function*(this: MemberController) {
      yield * this.checkAndExpire()

      const put = yield * this.conversationService.postParticipants(this.chatroom, [this.passport.id])

      return 0 < put.length
    }.bind(this))
  }

  private *checkAndExpire() {
    const exists = yield * this.conversationService.expire([this.chatroom])

    if (0 === exists.length) {
      throw new NotFoundException()
    }
  }
}
