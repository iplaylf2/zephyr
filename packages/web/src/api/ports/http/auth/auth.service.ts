import { Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UserService } from '../../../../domains/user/user.service.js'

@Injectable()
export class AuthService {
  @Inject()
  private readonly jwtService!: JwtService

  @Inject()
  private readonly userService!: UserService

  public *authenticate(token: string) {
    const passport: AuthService.Passport = this.jwtService.verify(token)

    const exists = yield * this.userService.active([passport.id])

    if (0 === exists.length) {
      return null
    }

    return passport
  }

  public authorize(userId: number) {
    return this.jwtService.sign({ id: userId } satisfies AuthService.Passport)
  }
}

export namespace AuthService{
  export type Passport = { id: number }
}
