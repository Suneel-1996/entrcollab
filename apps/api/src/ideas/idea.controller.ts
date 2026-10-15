import { Body, Controller, Get, Header, Headers, HttpCode, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { IdeaService } from './idea.service';
@Controller('ideas')
export class IdeaController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(IdeaService) private readonly ideas: IdeaService) {}
  @Post()
  @Header('Cache-Control', 'no-store')
  async create(@Headers('authorization') header: string | undefined, @Body() body: unknown) { const user = await this.auth.me(header); return this.ideas.create(user.id, body); }
  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Headers('authorization') header: string | undefined, @Query() query: unknown) { const user = await this.auth.me(header); return this.ideas.list(user.id, query); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async read(@Headers('authorization') header: string | undefined, @Param('id') id: string) { const user = await this.auth.me(header); return this.ideas.read(user.id, id); }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  async replace(@Headers('authorization') header: string | undefined, @Param('id') id: string, @Body() body: unknown) { const user = await this.auth.me(header); return this.ideas.replace(user.id, id, body); }
  @Post(':id/publish')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async publish(@Headers('authorization') header: string | undefined, @Param('id') id: string, @Body() body: unknown) { const user = await this.auth.me(header); return this.ideas.action(user.id, id, body, 'PUBLISHED'); }
  @Post(':id/archive')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async archive(@Headers('authorization') header: string | undefined, @Param('id') id: string, @Body() body: unknown) { const user = await this.auth.me(header); return this.ideas.action(user.id, id, body, 'ARCHIVED'); }
}
