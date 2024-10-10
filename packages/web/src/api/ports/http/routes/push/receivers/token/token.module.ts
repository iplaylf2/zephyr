import { TokenController, tokenPath } from './token.controller.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [TokenController],
  providers: [tokenPath.provider],
})
export class TokenModule {}
