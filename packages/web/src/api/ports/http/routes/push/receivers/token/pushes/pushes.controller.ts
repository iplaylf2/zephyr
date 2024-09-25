import { Controller, Delete, Get, Inject, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { path } from '../../../../../pattern.js'

@ApiTags('push/receivers/:token/pushes')
@Controller('pushes')
export class PushesController {
  @Inject(path.token)
  private readonly token!: string

  @Delete()
  public [`@Delete()`]() {
    void this.token
  }

  @Get()
  public [`@Get()`]() {}

  @Put()
  public [`@Put()`]() {}
}
