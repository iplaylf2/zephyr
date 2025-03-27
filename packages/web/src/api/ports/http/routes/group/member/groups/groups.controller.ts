import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Controller, Get, Inject } from '@nestjs/common'
import { GroupService } from '../../../../../../../domains/conversation/domains/group/group.service.js'
import { Passport } from '../../../../auth/auth.guard.js'
import { RequirePassport } from '../../../../decorators/require-passport.decorator.js'
import { groups } from './groups.dto.js'
import { unsafeGlobalScopeRun } from '@zephyr/kit/effection/global-scope.js'

@ApiTags('group/member/groups')
@RequirePassport()
@Controller('groups')
export class GroupsController {
  @Inject()
  private readonly conversationService!: GroupService

  @Inject()
  private readonly passport!: Passport

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
}
