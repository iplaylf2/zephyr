import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { main, suspend, until, useScope } from 'effection'
import { AppModule } from './app.module.js'
import { NestFactory } from '@nestjs/core'
import { initGlobalScope } from '@zephyr/kit/effection/global-scope.js'
import { patchNestjsSwagger } from '@anatine/zod-nestjs'

await main(function* () {
  const scope = yield* useScope()

  initGlobalScope(scope)

  const app = yield* until(NestFactory.create(AppModule))

  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .addBearerAuth()
    .build()

  patchNestjsSwagger()

  const document = SwaggerModule.createDocument(app, swaggerConfig)

  SwaggerModule.setup('api', app, document)

  yield* until(app.listen(3000))

  try {
    yield* suspend()
  }
  finally {
    yield* until(app.close())
  }
})
