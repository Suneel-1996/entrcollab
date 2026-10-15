import { IdeaModule } from './ideas/idea.module';
import { ProfileModule } from './profiles/profile.module';
import { AuthModule } from './auth/auth.module';
import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { HealthController } from './health.controller';
@Module({ imports: [AuthModule, ProfileModule, IdeaModule], controllers: [HealthController], providers: [DatabaseService] })
export class AppModule {}
