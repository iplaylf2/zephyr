/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { ClientDenyList } from './extension/client/deny-list.js'
import { FactoryProvider } from '@nestjs/common'
import { PrismaClient as RawClient } from './generated/index.js'
import { ResourceManagerService } from '../../common/resource-manager/resource-manager.service.js'
import { call } from 'effection'
import { conversation } from './extension/client/conversation.js'
import { conversationXParticipant } from './extension/client/conversation-x-participant.js'
import { dialogue } from './extension/client/dialogue.js'
import { effection } from './extension/client/transaction.js'
import { env } from '../../env.js'
import { globalScope } from '../../kits/effection/global-scope.js'
import { pushReceiver } from './extension/client/push-receiver.js'
import { pushSubscription } from './extension/client/push-subscription.js'
import { user } from './extension/client/user.js'

const useFactory = (resourceManagerService: ResourceManagerService) => globalScope.run(() =>
  resourceManagerService.initialize(
    function*() {
      const client = new RawClient({ datasourceUrl: env.prisma.datasourceUrl })
        .$extends(effection)
        .$extends(user)
        .$extends(conversation)
        .$extends(conversationXParticipant)
        .$extends(dialogue)
        .$extends(pushReceiver)
        .$extends(pushSubscription)

      yield * call(
        () => client.$connect(),
      )

      return client
    },
    function*(client) {
      yield * call(
        () => client.$disconnect(),
      )
    },
  ),
)

type ExtendedClient = Awaited<ReturnType<typeof useFactory>>

export interface PrismaClient extends ExtendedClient {}
export abstract class PrismaClient {}

export type PrismaTransaction = Omit<PrismaClient, ClientDenyList>

export const prismaProvider = {
  inject: [ResourceManagerService],
  provide: PrismaClient,
  useFactory,
} satisfies FactoryProvider
