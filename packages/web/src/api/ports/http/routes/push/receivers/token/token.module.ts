import { TokenController, tokenPath } from './token.controller.js'
import { Module } from '@nestjs/common'
import { PushModule } from '../../../../../../../domains/push/push.module.js'

@Module({
  controllers: [TokenController],
  imports: [PushModule],
  providers: [tokenPath.provider],
})
export class TokenModule {}
