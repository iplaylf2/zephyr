import { TypeController, typePath } from './type.controller.js'
import { AuthModule } from '../../../../../../auth/auth.module.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [TypeController],
  imports: [AuthModule],
  providers: [typePath.provider],
})
export class TypeModule {}
