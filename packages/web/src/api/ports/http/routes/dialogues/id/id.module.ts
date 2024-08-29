import { IdController, idPath } from './id.controller.js'
import { AuthModule } from '../../../auth/auth.module.js'
import { Module } from '@nestjs/common'

@Module({
  controllers: [IdController],
  imports: [AuthModule],
  providers: [idPath.provider],
})
export class IdModule {
}
