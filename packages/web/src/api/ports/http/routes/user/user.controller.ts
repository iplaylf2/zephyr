import { ApiCreatedResponse, ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger'
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Inject, InternalServerErrorException, Post, Put,
} from '@nestjs/common'
import { AuthService } from '../../auth/auth.service.js'
import { Passport } from '../../auth/auth.guard.js'
import { RequirePassport } from '../../decorators/require-passport.decorator.js'
import { UserService } from '../../../../../domains/user/user.service.js'
import { globalScope } from '../../../../../kits/effection/global-scope.js'
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
  public [`@Delete()`](@Passport.param passport: Passport) {
    return globalScope.run(function*(this: UserController) {
      const deleted = yield * this.userService.unregister([passport.id])

      return 0 < deleted.length
    }.bind(this))
  }

  @ApiOkResponse({
    type: user.InfoDto,
  })
  @RequirePassport()
  @Get('info')
  public async [`@Get('info')`](@Passport.param passport: Passport): Promise<user.InfoDto> {
    return globalScope.run(function*(this: UserController) {
      const infos = yield * this.userService.get([passport.id])

      if (0 === infos.length) {
        throw new InternalServerErrorException()
      }

      return infos[0]!
    }.bind(this))
  }

  @ApiCreatedResponse({
    type: user.CreationResultDto,
  })
  @Post()
  public async [`@Post()`](@Body() info: user.InfoDto): Promise<user.CreationResultDto> {
    return globalScope.run(function*(this: UserController) {
      const id = yield * this.userService.register(info)

      return {
        id: id,
        token: this.authService.authorize(id),
      }
    }.bind(this))
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePassport()
  @Put('info')
  public async [`@Put('info')`](@Passport.param passport: Passport, @Body() info: user.InfoDto) {
    await globalScope.run(() =>
      this.userService.put(passport.id, info),
    )
  }
}
