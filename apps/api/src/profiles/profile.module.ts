import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseService } from '../database.service';
import { ProfileController } from './profile.controller';
import { PROFILE_REPOSITORY, PrismaProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';
@Module({ imports: [AuthModule], controllers: [ProfileController], providers: [DatabaseService, ProfileService, { provide: PROFILE_REPOSITORY, useClass: PrismaProfileRepository }] })
export class ProfileModule {}
