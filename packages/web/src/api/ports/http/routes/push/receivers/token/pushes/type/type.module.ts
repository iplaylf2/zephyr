import { TypeController, typePath } from './type.controller.js'
import { Module } from '@nestjs/common'
import { PushModule } from '../../../../../../../../../domains/push/push.module.js'
import { path } from '../../../../../../pattern.js'

@Module({
  controllers: [TypeController],
  imports: [PushModule],
  providers: [path.token.provider, typePath.provider],
})
export class TypeModule {}
