import { APP_PIPE } from '@nestjs/core'
import { IdModule as DialogueIdModule } from './routes/dialogues/id/id.module.js'
import { DialogueModule } from './routes/dialogue/dialogue.module.js'
import { DialoguesModule } from './routes/dialogues/dialogues.module.js'
import { IdModule as GroupIdModule } from './routes/groups/id/id.module.js'
import { GroupsModule } from './routes/group/member/groups/groups.module.js'
import { MemberModule } from './routes/groups/id/member/member.module.js'
import { Module } from '@nestjs/common'
import { SubscriptionsModule as ReceiverSubscriptionsModule } from './routes/receivers/id/subscriptions/subscriptions.module.js'
import { UserModule as ReceiverUserModule } from './routes/receiver/user/user.module.js'
import { IdModule as ReceiversModule } from './routes/receivers/id/id.module.js'
import { UserModule as ReceiversUserModule } from './routes/receivers/id/user/user.module.js'
import { UserModule } from './routes/user/user.module.js'
import { UsersModule } from './routes/users/users.module.js'
import { ZodValidationPipe } from '@anatine/zod-nestjs'
import { path } from './pattern.js'
import { router } from './kits/router.js'

@Module({
  imports: [
    DialogueModule,
    DialoguesModule,
    UserModule,
    UsersModule,
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
        module: ReceiverUserModule,
        path: 'receiver',
      },
      {
        children: [
          ReceiversModule,
          { children: [ReceiverSubscriptionsModule, ReceiversUserModule], path: path.receiver.pattern },
        ],
        path: 'receivers',
      },
      {
        module: DialogueIdModule,
        path: 'dialogues',
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
