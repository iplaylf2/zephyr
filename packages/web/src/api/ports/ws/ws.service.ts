import { IncomingMessage, Server } from 'http'
import { Inject, Injectable } from '@nestjs/common'
import { Duplex } from 'stream'
import { HttpAdapterHost } from '@nestjs/core'
import { ModuleRaii } from '../../../common/module-raii.js'
import { ReceiverService } from '../../../domains/receiver/receiver.service.js'
import { URLPattern } from 'urlpattern-polyfill'
import { WebSocketServer } from 'ws'
import { globalScope } from '../../../kits/effection/global-scope.js'
import { suspend } from 'effection'

@Injectable()
export class WsService extends ModuleRaii {
  @Inject()
  private readonly httpAdapterHost!: HttpAdapterHost

  @Inject()
  private readonly receiverService!: ReceiverService

  public constructor() {
    super()

    this.initializeCallbacks.push(() => this.listen())
  }

  private *listen() {
    const urlPattern = new URLPattern({ pathname: '/receiver/:id' })
    const websocketServer = new WebSocketServer({ noServer: true })
    const upgradeListener = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const patternResult = urlPattern.exec(request.url, 'ws://x')
      const id = patternResult?.pathname.groups['id'] ?? null

      if (null === id) {
        socket.destroy()

        return
      }

      void globalScope.run(() =>
        this.tryUpgrading(websocketServer, request, socket, head, id),
      )
    }

    const httpServer: Server = this.httpAdapterHost.httpAdapter.getHttpServer()
    httpServer.addListener('upgrade', upgradeListener)

    try {
      yield * suspend()
    }
    finally {
      httpServer.removeListener('upgrade', upgradeListener)
    }
  }

  private *tryUpgrading(
    websocketServer: WebSocketServer,
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    id: string,
  ) {
    try {
      const channel = yield * this.receiverService.getChannel(id)

      if (null === channel) {
        socket.destroy()

        return
      }

      websocketServer.handleUpgrade(request, socket, head, (ws) => {
        const subscription = channel.subscribe({
          complete() {
            ws.close()
          },
          error() {
            ws.close()
          },
          next(x) {
            ws.send(x, () => {})
          },
        })

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
