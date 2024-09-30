import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Controller, Get, Inject, Query } from '@nestjs/common'
import { UserService } from '../../../../../domains/user/user.service.js'
import { globalScope } from '../../../../../kits/effection/global-scope.js'
import { users } from './users.dto.js'

@ApiTags('users')
@Controller('users')
export class UsersController {
  @Inject()
  private readonly userService!: UserService

  @ApiOkResponse({
    isArray: true,
    type: users.InfoDto,
  })
  @Get('info')
  public [`@Get('info')`](@Query() infosQuery: users.InfosQueryDto): Promise<readonly users.InfoDto[]> {
    return globalScope.run(() =>
      this.userService.get(infosQuery.users),
    )
  }
}
