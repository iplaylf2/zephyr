import { APP_PIPE } from '@nestjs/core'
import { ClaimerModule } from './routes/push/receivers/token/claimer/claimer.module.js'
import { IdModule as DialogueIdModule } from './routes/dialogues/id/id.module.js'
import { DialogueModule } from './routes/dialogue/dialogue.module.js'
import { DialoguesModule } from './routes/dialogues/dialogues.module.js'
import { IdModule as GroupIdModule } from './routes/groups/id/id.module.js'
import { GroupsModule } from './routes/group/member/groups/groups.module.js'
import { MemberModule } from './routes/groups/id/member/member.module.js'
import { Module } from '@nestjs/common'
import { PushModule } from './routes/push/push.module.js'
import { PushesModule } from './routes/push/receivers/token/pushes/pushes.module.js'
import { ReceiverModule } from './routes/push/claimer/receiver/receiver.module.js'
import { UserModule } from './routes/user/user.module.js'
import { UsersModule } from './routes/users/users.module.js'
import { ZodValidationPipe } from '@anatine/zod-nestjs'
import { path } from './pattern.js'
import { router } from './kits/router.js'

@Module({
  imports: [
    UserModule,
    UsersModule,
    DialogueModule,
    DialoguesModule,
    PushModule,
    ...router.register([
      {
        module: GroupsModule,
        path: 'group/member',
      },
      {
        children: [
          GroupIdModule,
          { children: [MemberModule], path: path.group.pattern },
        ],
        path: 'groups',
      },
      {
        module: DialogueIdModule,
        path: 'dialogues',
      },
      {
        children: [
          { module: ReceiverModule, path: 'claimer' },
          { children: [ClaimerModule, PushesModule], path: `receivers/${path.token.pattern}` },
        ],
        path: 'push',
      },
    ]),
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class HttpModule {}
