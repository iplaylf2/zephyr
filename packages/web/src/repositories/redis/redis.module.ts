import { FactoryProvider, Module } from '@nestjs/common'
import { resource, until } from 'effection'
import { ConversationService } from './schemas/conversation.service.js'
import { GenericService } from './schemas/generic.service.js'
import { PushService } from './schemas/push.service.js'
import { RedisService } from './redis.service.js'
import { ResourceManagerModule } from '../../common/resource-manager/resource-manager.module.js'
import { ResourceManagerService } from '../../common/resource-manager/resource-manager.service.js'
import { UserService } from './schemas/user.service.js'
import { createClient } from '@redis/client'
import { env } from '../../env.js'

const redisServiceProvider = {
  inject: [ResourceManagerService],
  provide: RedisService,
  useFactory(resourceManagerService: ResourceManagerService) {
    return resourceManagerService.provide(
      () => resource(function* (provide) {
        const client = createClient({ url: env.redis.url })

        yield* until(client.connect())

        try {
          yield* provide(client)
        }
        finally {
          yield* until(client.quit())
        }
      },
      ),
    )
  },
} satisfies FactoryProvider

@Module({
  exports: [
    ConversationService,
    GenericService,
    PushService,
    redisServiceProvider,
    UserService,
  ],
  imports: [ResourceManagerModule],
  providers: [
    ConversationService,
    GenericService,
    PushService,
    redisServiceProvider,
    UserService,
  ],
})
export class RedisModule {}
