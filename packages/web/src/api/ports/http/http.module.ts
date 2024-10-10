import { APP_PIPE } from '@nestjs/core'
import { ClaimerModule } from './routes/push/receivers/token/claimer/claimer.module.js'
import { TypeModule as ClaimerPushesTypeModule } from './routes/push/claimer/receiver/pushes/type/type.module.js'
import { DialogueModule } from './routes/dialogue/dialogue.module.js'
import { IdModule as DialoguesIdModule } from './routes/dialogues/id/id.module.js'
import { DialoguesModule } from './routes/dialogues/dialogues.module.js'
import { IdModule as GroupsIdModule } from './routes/groups/id/id.module.js'
import { GroupsModule } from './routes/group/member/groups/groups.module.js'
import { MemberModule } from './routes/groups/id/member/member.module.js'
import { Module } from '@nestjs/common'
import { PushModule } from './routes/push/push.module.js'
import { TypeModule as PushesTypeModule } from './routes/push/receivers/token/pushes/type/type.module.js'
import { ReceiverModule } from './routes/push/claimer/receiver/receiver.module.js'
import { TokenModule as ReceiversTokenModule } from './routes/push/receivers/token/token.module.js'
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
          GroupsIdModule,
          { children: [MemberModule], path: path.group.pattern },
        ],
        path: 'groups',
      },
      {
        module: DialoguesIdModule,
        path: 'dialogues',
      },
      {
        children: [
          {
            children: [{
              module: ClaimerPushesTypeModule,
              path: 'receiver/pushes',
            }],
            module: ReceiverModule,
            path: 'claimer',
          },
          {
            children: [
              {
                children: [
                  ClaimerModule,
                  {
                    module: PushesTypeModule,
                    path: 'pushes',
                  },
                ],
                path: path.token.pattern,
              },
            ],
            module: ReceiversTokenModule,
            path: 'receivers',
          },
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
