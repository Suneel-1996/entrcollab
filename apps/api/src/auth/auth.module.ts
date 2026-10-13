import { Module } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { AUTH_CONFIG, readAuthConfig, type AuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IDENTITY_REPOSITORY, PrismaIdentityRepository } from './identity.repository';
import { TOKEN_VERIFIER, SupabaseTokenVerifier } from './token-verifier';

@Module({
  controllers: [AuthController],
  providers: [
    DatabaseService, AuthService,
    { provide: AUTH_CONFIG, useFactory: () => readAuthConfig(process.env) },
    { provide: TOKEN_VERIFIER, inject: [AUTH_CONFIG], useFactory: (config: AuthConfig | null) => new SupabaseTokenVerifier(config) },
    { provide: IDENTITY_REPOSITORY, useClass: PrismaIdentityRepository },
  ],
})
export class AuthModule {}
