import { Directive } from '@zephyr/kit/effection/operation.js'
import { PrismaTransaction } from '../../../repositories/prisma/client.js'

export namespace subscription{
  export type Validator = {
    readonly type: string
    validate(
      tx: PrismaTransaction, receiverId: number, pushIdArray: readonly number[]
    ): Directive<readonly number[]>
  }
}
