import { Operation } from 'effection'
import { P } from 'ts-pattern'
import { PrismaTransaction } from '../../../repositories/prisma/client.js'

export namespace push{
  export type Validator = {
    readonly pattern: P.Pattern<unknown>

    validate(tx: PrismaTransaction, receiver: number, pushes: number[]): Operation<readonly number[]>
  }
}
