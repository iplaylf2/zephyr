import { Module, ValueProvider } from '@nestjs/common'
import { DrizzleModule } from '../../repositories/drizzle/drizzle.module.js'
import { RenewalScheduleService } from './renewal-schedule.service.js'

@Module({
  exports: [RenewalScheduleService],
  imports: [DrizzleModule],
  providers: [
    {
      provide: RenewalScheduleService.Config,
      useValue: new RenewalScheduleService.Config(100),
    } satisfies ValueProvider,
    RenewalScheduleService,
  ],
})
export class RenewalScheduleModule {
}
