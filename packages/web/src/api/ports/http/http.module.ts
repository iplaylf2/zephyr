import { APP_PIPE } from '@nestjs/core'
import { IdModule as ChatroomsModule } from './routes/chatrooms/id/id.module.js'
import { IdModule as ConversationIdModule } from './routes/conversations/id/id.module.js'
import { ConversationModule } from './routes/conversation/conversation.module.js'
import { ConversationsModule } from './routes/conversations/conversations.module.js'
import { MemberModule } from './routes/chatrooms/id/member/member.module.js'
import { Module } from '@nestjs/common'
import { SubscriptionsModule as ReceiverSubscriptionsModule } from './routes/receivers/id/subscriptions/subscriptions.module.js'
import { UserModule as ReceiverUserModule } from './routes/receivers/id/user/user.module.js'
import { IdModule as ReceiversModule } from './routes/receivers/id/id.module.js'
import { SubscriptionsModule } from './routes/receiver/user/user.module.js'
import { UserModule } from './routes/user/user.module.js'
import { UsersModule } from './routes/users/users.module.js'
import { ZodValidationPipe } from '@anatine/zod-nestjs'
import { path } from './pattern.js'
import { router } from './kits/router.js'

@Module({
  imports: [
    ConversationModule,
    ConversationsModule,
    UserModule,
    UsersModule,
    ...router.register([
      {
        children: [
          ChatroomsModule,
          { children: [MemberModule], path: path.chatroom.pattern },
        ],
        path: 'chatrooms',
      },
      {
        module: SubscriptionsModule,
        path: 'receiver',
      },
      {
        children: [
          ReceiversModule,
          { children: [ReceiverSubscriptionsModule, ReceiverUserModule], path: path.receiver.pattern },
        ],
        path: 'receivers',
      },
      {
        module: ConversationIdModule,
        path: 'conversations',
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
