import { all, sleep, until } from 'effection'
import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { option, readonlyArray, readonlyNonEmptyArray, readonlyRecord } from 'fp-ts'
import { Directive } from '@zephyr/kit/effection/operation.js'
import { DrizzleService } from '../../repositories/drizzle/drizzle.service.js'
import { ModuleRaii } from '../../common/module-raii.js'
import { Temporal } from 'temporal-polyfill'
import { magicSql } from '../../repositories/kit/magic-sql.js'
import { pipe } from 'fp-ts/lib/function.js'
import { renewalSchedules } from '../../repositories/drizzle/schemas/renewal-schedules.js'
import { selectedField } from '../../repositories/kit/selected-field.js'

export class RenewalScheduleServices extends ModuleRaii {
  private readonly drizzleService!: DrizzleService
  private readonly executorRegistry = new Map<string, Executor>()

  public constructor() {
    super()

    this.initializePlans.push(() => this.periodicCleanup())
    this.initializePlans.push(() => this.periodicExecute())
  }

  public bindExecutor(businessType: string, executor: Executor): option.Option<void> {
    if (this.executorRegistry.has(businessType)) {
      return option.none
    }

    this.executorRegistry.set(businessType, executor)

    return option.some(void 0)
  }

  public* ensureSchedule(schedules: Schedule[]) {
    const now = Temporal.Now.instant()
    const span = Temporal.Duration.from({ minutes: 1 })
    const excludedTargetExpiresAt = selectedField.qualify(
      'excluded',
      renewalSchedules.targetExpiresAt,
    )

    yield* until(
      this.drizzleService
        .insert(renewalSchedules)
        .values(
          schedules.map(
            x => ({ expiresAt: x.targetExpiresAt, scheduleBarrier: now, ...x }),
          ),
        )
        .onConflictDoUpdate({
          set: {
            scheduleBarrier: now.add(span),
            targetExpiresAt: excludedTargetExpiresAt,
            version: sql`${renewalSchedules.version} + 1`,
          },
          setWhere: lt(renewalSchedules.targetExpiresAt, excludedTargetExpiresAt),
          target: [renewalSchedules.businessId, renewalSchedules.businessType],
        }),
    )
  }

  private* periodicCleanup(): Directive<void> {
    const span = Temporal.Duration.from({ hours: 1 }).total('milliseconds')

    while (true) {
      yield* until(
        this.drizzleService
          .delete(renewalSchedules)
          .where(lt(renewalSchedules.expiresAt, Temporal.Now.instant())),
      )
      yield* sleep(span)
    }
  }

  private* periodicExecute(): Directive<void> {
    const span = Temporal.Duration.from({ minutes: 1 })
    const spanMilliseconds = span.total('milliseconds')

    while (true) {
      const now = Temporal.Now.instant()

      const schedules = yield* until(
        this.drizzleService
          .update(renewalSchedules)
          .set({
            scheduleBarrier: now.add(span),
            version: sql`${renewalSchedules.version} + 1`,
          })
          .where(
            and(
              gt(renewalSchedules.expiresAt, now),
              lt(renewalSchedules.scheduleBarrier, now),
            ),
          )
          .returning(
            selectedField.omit(
              renewalSchedules,
              ['createdAt', 'expiresAt', 'scheduleBarrier', 'updatedAt'],
            ),
          ),
      )

      yield* pipe(
        schedules,
        readonlyNonEmptyArray.groupBy(x => x.businessType),
        readonlyRecord.toEntries,
        readonlyArray.map(
          ([type, schedules]) => this.executorRegistry.get(type)!(schedules),
        ),
        all,
      )

      const [vlSql, vl] = magicSql.valuesLists(
        schedules,
        ['businessId', 'businessType', 'targetExpiresAt', 'version'],
        'vl',
      )

      yield* until(
        this.drizzleService
          .update(renewalSchedules)
          .set({
            scheduleBarrier: vl.targetExpiresAt,
          })
          .where(
            and(
              eq(renewalSchedules.businessId, vl.businessId),
              eq(renewalSchedules.businessType, vl.businessType),
              eq(renewalSchedules.version, vl.version),
            ),
          )
          .from(vlSql),
      )

      yield* sleep(spanMilliseconds)
    }
  }
}

export type Schedule = {
  businessId: number
  businessType: string
  targetExpiresAt: Temporal.Instant
}

export type Executor = (schedules: readonly Schedule[]) => Directive<void>
