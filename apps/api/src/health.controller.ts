import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './database.service';
@Controller('health')
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  @Get() live() { return { status: 'ok' }; }
  @Get('ready') async ready() {
    if (!(await this.database.isReady())) throw new ServiceUnavailableException({ status: 'unavailable' });
    return { status: 'ok' };
  }
}
