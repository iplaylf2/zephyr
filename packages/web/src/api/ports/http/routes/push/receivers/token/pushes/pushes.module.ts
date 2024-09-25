import { Module } from '@nestjs/common'
import { PushesController } from './pushes.controller.js'
import { path } from '../../../../../pattern.js'

@Module({
  controllers: [PushesController],
  providers: [path.token.provider],
})
export class PushesModule {}
