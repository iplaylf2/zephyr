import { ApiCreatedResponse, ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger'
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Inject, NotFoundException, Patch, Post,
} from '@nestjs/common'
import { AuthService } from '../../auth/auth.service.js'
import { Passport } from '../../auth/auth.guard.js'
import { RequirePassport } from '../../decorators/require-passport.decorator.js'
import { UserService } from '../../../../../domains/user/user.service.js'
import { cOperation } from '../../../../../common/fp-effection/c-operation.js'
import { pipe } from 'fp-ts/lib/function.js'
import { unsafeGlobalScopeRun } from '../../../../../kits/effection/global-scope.js'
import { user } from './user.dto.js'

@ApiTags('user')
@Controller('user')
export class UserController {
  @Inject()
  private readonly authService!: AuthService

  @Inject()
  private readonly userService!: UserService

  @ApiResponse({
    description: 'right now',
    type: Boolean,
  })
  @RequirePassport()
  @Delete()
  public [`@Delete()`](@Passport.param passport: Passport): Promise<boolean> {
    return unsafeGlobalScopeRun(pipe(
      () => this.userService.unregister([passport.id]),
      cOperation.map(x => 0 < x.length),
    ))
  }

  @ApiOkResponse({
    type: user.InfoDto,
  })
  @RequirePassport()
  @Get('info')
  public async [`@Get('info')`](@Passport.param passport: Passport): Promise<user.InfoDto> {
    return unsafeGlobalScopeRun(function*(this: UserController) {
      const [user] = yield * this.userService.get([passport.id])

      if (!user) {
        throw new NotFoundException()
      }

      return user
    }.bind(this))
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePassport()
  @Patch('info')
  public async [`@Patch('info')`](@Passport.param passport: Passport, @Body() info: user.InfoDto) {
    await unsafeGlobalScopeRun(
      () => this.userService.patch(passport.id, info),
    )
  }

  @ApiCreatedResponse({
    type: user.CreationResultDto,
  })
  @Post()
  public async [`@Post()`](@Body() info: user.InfoDto): Promise<user.CreationResultDto> {
    return unsafeGlobalScopeRun(pipe(
      () => this.userService.register(info),
      cOperation.map(id => ({ id: id, token: this.authService.authorize(id) })),
    ))
  }
}
