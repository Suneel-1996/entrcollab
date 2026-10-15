import { Controller, Get, Header, Headers, Inject } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Headers('authorization') authorization: string | undefined) { return this.auth.me(authorization); }
}
