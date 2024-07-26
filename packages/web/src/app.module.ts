import { ApiModule } from './api/api.module.js'
import { Module } from '@nestjs/common'

@Module({
  imports: [ApiModule],
})
export class AppModule {}
