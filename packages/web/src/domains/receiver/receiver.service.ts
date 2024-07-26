import { Injectable } from '@nestjs/common'
import { Observable } from 'rxjs'
import { Operation } from 'effection'

@Injectable()
export class ReceiverService {
  public getChannel(channelId: string): Operation<Observable<string> | null> {
    void channelId

    throw new Error()
  }
}
