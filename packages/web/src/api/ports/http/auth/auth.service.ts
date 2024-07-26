import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UserService } from '../../../../domains/user/user.service.js'
import { spawn } from 'effection'

@Injectable()
export class AuthService {
  @Inject()
  private readonly jwtService!: JwtService

  @Inject()
  private readonly userService!: UserService

  public *authenticate(token: string) {
    const passport: AuthService.Passport = this.jwtService.verify(token)

    void (yield * spawn(() => this.userService.expire([passport.id])))

    const exists = yield * this.userService.exists([passport.id])

    if (0 === exists.length) {
      throw new UnauthorizedException()
    }

    return passport
  }

  public authorize(userId: string) {
    return this.jwtService.sign({ id: userId } satisfies AuthService.Passport)
  }
}

export namespace AuthService{
  export type Passport = { id: string }
}
