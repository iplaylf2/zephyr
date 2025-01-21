import * as m1 from './groups/parallel.js'
import * as m2 from './groups/serial.js'
import { StreamMessageBody } from './stream.js'

export namespace group{
  export const Parallel = m1.Parallel
  export type Parallel<T extends StreamMessageBody> = m1.Parallel<T>
  export namespace Parallel {
    export type Config = m1.Parallel.Config
    export type Options = m1.Parallel.Options
  }

  export const Serial = m2.Serial
  export type Serial<T extends StreamMessageBody> = m2.Serial<T>
  export namespace Serial {
    export type Config = m2.Serial.Config
    export type Options = m2.Serial.Options
  }
}
