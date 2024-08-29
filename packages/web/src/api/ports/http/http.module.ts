import { APP_PIPE } from '@nestjs/core'
import { IdModule as ChatroomIdModule } from './routes/chatrooms/id/id.module.js'
import { MemberModule as ChatroomMemberModule } from './routes/chatroom/member/member.module.js'
import { IdModule as DialogueIdModule } from './routes/dialogues/id/id.module.js'
import { DialogueModule } from './routes/dialogue/dialogue.module.js'
import { DialoguesModule } from './routes/dialogues/dialogues.module.js'
import { MemberModule } from './routes/chatrooms/id/member/member.module.js'
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
        module: ChatroomMemberModule,
        path: 'chatroom',
      },
      {
        children: [
          ChatroomIdModule,
          { children: [MemberModule], path: path.chatroom.pattern },
        ],
        path: 'chatrooms',
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
export class HttpModule {
}
