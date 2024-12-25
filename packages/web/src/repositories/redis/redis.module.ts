import { FactoryProvider, Module } from '@nestjs/common'
import { ConversationService } from './entities/conversation.service.js'
import { GenericService } from './entities/generic.service.js'
import { PushService } from './entities/push.service.js'
import { RedisService } from './redis.service.js'
import { ResourceManagerModule } from '../../common/resource-manager/resource-manager.module.js'
import { ResourceManagerService } from '../../common/resource-manager/resource-manager.service.js'
import { UserService } from './entities/user.service.js'
import { call } from 'effection'
import { createClient } from '@redis/client'
import { env } from '../../env.js'
import { globalScope } from '../../kits/effection/global-scope.js'

const redisServiceProvider = {
  inject: [ResourceManagerService],
  provide: RedisService,
  useFactory(resourceManagerService: ResourceManagerService) {
    return globalScope.run(() =>
      resourceManagerService.initialize(
        function*() {
          const client = createClient({ url: env.redis.url })

          yield * call(
            () => client.connect(),
          )

          return client
        },
        function*(client) {
          yield * call(
            () => client.quit(),
          )
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
