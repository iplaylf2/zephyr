import { Operation } from 'effection'
import { PrismaTransaction } from '../../../repositories/prisma/client.js'

export namespace subscription{
  export type Validator = {
    readonly type: string
    validate(
      tx: PrismaTransaction, receiver: number, pushes: readonly number[]
    ): Operation<readonly number[]>
  }
}
