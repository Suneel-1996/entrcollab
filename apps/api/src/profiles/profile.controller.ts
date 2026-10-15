import { Body, Controller, Get, Header, Headers, Inject, Param, Put } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ProfileService } from './profile.service';

@Controller('profiles')
export class ProfileController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(ProfileService) private readonly profiles: ProfileService) {}
  @Get('me')
  @Header('Cache-Control', 'no-store')
  async own(@Headers('authorization') header: string | undefined) { const user = await this.auth.me(header); return this.profiles.own(user.id); }
  @Put('me')
  @Header('Cache-Control', 'no-store')
  async replace(@Headers('authorization') header: string | undefined, @Body() body: unknown) { const user = await this.auth.me(header); return this.profiles.replace(user.id, body); }
  @Get(':userId')
  @Header('Cache-Control', 'no-store')
  async member(@Headers('authorization') header: string | undefined, @Param('userId') userId: string) { const user = await this.auth.me(header); return this.profiles.member(user.id, userId); }
}
