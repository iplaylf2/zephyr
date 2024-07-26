import { Controller, Delete, Get, Inject, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { RequirePassport } from '../../../../decorators/require-passport.decorator.js'
import { path } from '../../../../pattern.js'

@ApiTags('receivers')
@RequirePassport()
@Controller('user')
export class UserController {
  @Inject(path.receiver)
  private readonly receiver!: string

  @Delete('subscriptions/chatroom')
  public [`@Delete('subscriptions/chatroom')`]() {
    void this.receiver
  }

  @Delete('subscriptions/conversation')
  public [`@Delete('subscriptions/conversation')`]() {
    void this.receiver
  }

  @Delete()
  public [`@Delete()`]() {
  }

  @Get('subscriptions')
  public [`@Get('subscriptions')`]() {
  }

  @Put('subscriptions/chatroom')
  public [`@Put('subscriptions/chatroom')`]() {
  }

  @Put('subscriptions/conversation')
  public [`@Put('subscriptions/conversation')`]() {
  }

  @Put()
  public [`@Put()`]() {
  }
}
