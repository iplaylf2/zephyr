import { Scope, suspend, useScope } from 'effection'
import { Callable } from '../types/function'
import { Directive } from './operation'
import { Simplify } from 'type-fest'
import { pipe } from 'fp-ts/lib/function'
import { readonlyRecord } from 'fp-ts'

export class RouterBuilder<T extends Record<string, Callable<void, any, Directive<any>>> = {}> {
  public constructor(private readonly router: T = {} as T) {}

  public build(): [workspace: Directive<void>, router: Router<T>] {
    let scope: Scope

    function* work() {
      scope = yield* useScope()

      yield* suspend()
    }

    return [
      work(),
      new Router(
        pipe(
          this.router,
          readonlyRecord.map(
            handler =>
              (...args: any[]) => scope.run(function* () {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                yield* handler(...args)
              }),
          ),
        ) as unknown as T,
      ),
    ]
  }

  public register<URI extends string, Handler extends Callable<void, any, Directive<any>>>(
    uri: URI,
    handler: Handler,
  ): string extends URI ?
      unknown :
      URI extends keyof T ?
        never :
        RouterBuilder<Simplify<Record<URI, Handler> & T>> {
    if (uri in this.router) {
      throw new Error()
    }

    return new RouterBuilder(Object.assign({ [uri]: handler }, this.router)) as any
  }
}

class Router<T extends Record<string, Callable<any, any, Directive<any>>>> {
  public constructor(private readonly raw: T) {}

  public dispatch<URI extends keyof T>(uri: URI, args: Parameters<T[URI]>) {
    this.raw[uri]!(...args)
  }
}
