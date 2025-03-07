import { IncomingMessage, Server } from 'http'
import { Inject, Injectable } from '@nestjs/common'
import { suspend, useScope } from 'effection'
import { Duplex } from 'stream'
import { HttpAdapterHost } from '@nestjs/core'
import { ModuleRaii } from '../../../common/module-raii.js'
import { PushService } from '../../../domains/push/push.service.js'
import { ReceiverService } from '../../../domains/push/receiver.service.js'
import { URLPattern } from 'urlpattern-polyfill'
import { WebSocketServer } from 'ws'
import { finalize } from 'rxjs'
import { ioOption } from 'fp-ts'
import { pipe } from 'fp-ts/lib/function.js'

@Injectable()
export class WsService extends ModuleRaii {
  @Inject()
  private readonly httpAdapterHost!: HttpAdapterHost

  @Inject()
  private readonly pushService!: PushService

  @Inject()
  private readonly receiverService!: ReceiverService

  public constructor() {
    super()

    this.initializeCallbacks.push(() => this.listen())
  }

  private* listen() {
    const scope = yield* useScope()

    const urlPattern = new URLPattern({ pathname: '/push/receivers/:token' })
    const websocketServer = new WebSocketServer({ noServer: true })
    const upgradeListener = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const patternResult = urlPattern.exec(request.url, 'ws://x')
      const token = patternResult?.pathname.groups['token'] ?? null

      if (null === token) {
        socket.destroy()

        return
      }

      void scope.run(
        () => this.tryUpgrading(websocketServer, request, socket, head, token),
      )
    }
    const httpServer: Server = this.httpAdapterHost.httpAdapter.getHttpServer()

    httpServer.addListener('upgrade', upgradeListener)

    try {
      yield* suspend()
    }
    finally {
      httpServer.removeListener('upgrade', upgradeListener)
      websocketServer.close()
    }
  }

  private* tryUpgrading(
    websocketServer: WebSocketServer,
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    token: string,
  ) {
    try {
      const receiverId = yield* this.pushService.getReceiver(token)

      const receiver = pipe(
        receiverId,
        ioOption.fromNullable,
        ioOption.chainIOK(
          x => () => this.receiverService.put(x).shared,
        ),
        ioOption.toNullable,
      )()

      if (!receiver) {
        socket.destroy()

        return
      }

      websocketServer.handleUpgrade(request, socket, head, (ws) => {
        const subscription = receiver
          .pipe(
            finalize(() => { ws.close() }),
          )
          .subscribe((x) => { ws.send(JSON.stringify(x)) })

        ws.on('close', () => {
          subscription.unsubscribe()
        })
      })
    }
    catch {
      socket.destroy()
    }
  }
}
