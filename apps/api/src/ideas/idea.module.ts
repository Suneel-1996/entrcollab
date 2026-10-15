import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseService } from '../database.service';
import { IdeaController } from './idea.controller';
import { IDEA_REPOSITORY, PrismaIdeaRepository } from './idea.repository';
import { IdeaService } from './idea.service';
@Module({ imports: [AuthModule], controllers: [IdeaController], providers: [DatabaseService, IdeaService, { provide: IDEA_REPOSITORY, useClass: PrismaIdeaRepository }] })
export class IdeaModule {}
