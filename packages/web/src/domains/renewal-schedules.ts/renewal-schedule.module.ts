import { DrizzleModule } from '../../repositories/drizzle/drizzle.module.js'
import { Module } from '@nestjs/common'
import { RenewalScheduleService } from './renewal-schedule.service.js'

@Module({
  exports: [RenewalScheduleService],
  imports: [DrizzleModule],
  providers: [RenewalScheduleService],
})
export class RenewalScheduleModule {
}
