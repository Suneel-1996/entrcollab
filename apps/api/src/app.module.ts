import { AuthModule } from './auth/auth.module';
import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { HealthController } from './health.controller';
@Module({ imports: [AuthModule], controllers: [HealthController], providers: [DatabaseService] })
export class AppModule {}
