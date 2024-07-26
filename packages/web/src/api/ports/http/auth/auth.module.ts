import { AuthService } from './auth.service.js'
import { JwtModule } from '@nestjs/jwt'
import { Module } from '@nestjs/common'
import { Passport } from './auth.guard.js'
import { UserModule } from '../../../../domains/user/user.module.js'

@Module({
  exports: [AuthService, Passport.provider],
  imports: [
    JwtModule.register({
      secret: 'fixme',
      signOptions: {
        audience: 'user',
        issuer: 'auth',
        subject: 'http',
      },
    }),
    UserModule,
  ],
  providers: [AuthService, Passport.provider],
})
export class AuthModule {}
