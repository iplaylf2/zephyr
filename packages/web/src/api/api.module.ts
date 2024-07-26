import { HttpModule } from './ports/http/http.module.js'
import { Module } from '@nestjs/common'
import { WsModule } from './ports/ws/ws.module.js'

@Module({
  imports: [HttpModule, WsModule],
})
export class ApiModule {
}
