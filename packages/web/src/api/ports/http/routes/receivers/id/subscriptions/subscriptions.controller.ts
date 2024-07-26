import { Controller, Delete, Get, Inject, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { path } from '../../../../pattern.js'

@ApiTags('receivers')
@Controller('subscriptions')
export class SubscriptionsController {
  @Inject(path.receiver)
  private readonly receiver!: string

  @Delete('chatroom')
  public [`@Delete('chatroom')`]() {
    void this.receiver
  }

  @Get()
  public [`@Get()`]() {
  }

  @Put('chatroom')
  public [`@Put('chatroom')`]() {
  }
}
