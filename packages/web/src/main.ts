import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { call, main, spawn, suspend, useScope } from 'effection'
import { AppModule } from './app.module.js'
import { NestFactory } from '@nestjs/core'
import { initGlobalScope } from './kits/effection/global-scope.js'
import { patchNestjsSwagger } from '@anatine/zod-nestjs'

await main(function *() {
  void (yield * spawn(function*() {
    const scope = yield * useScope()

    initGlobalScope(scope)

    yield * suspend()
  }))

  const app = yield * call(NestFactory.create(AppModule))

  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .addBearerAuth()
    .build()

  patchNestjsSwagger()

  const document = SwaggerModule.createDocument(app, swaggerConfig)

  SwaggerModule.setup('api', app, document)

  yield * call(app.listen(3000))
  yield * suspend()
})
