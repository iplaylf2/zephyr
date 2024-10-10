import { TypeController, typePath } from './type.controller.js'
import { AuthModule } from '../../../../../../auth/auth.module.js'
import { Module } from '@nestjs/common'
import { path } from '../../../../../../pattern.js'

@Module({
  controllers: [TypeController],
  imports: [AuthModule],
  providers: [path.token.provider, typePath.provider],
})
export class TypeModule {}
