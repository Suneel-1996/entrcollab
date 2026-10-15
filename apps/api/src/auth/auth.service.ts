import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import { IDENTITY_REPOSITORY, type IdentityRepository } from './identity.repository';
import { TOKEN_VERIFIER, type TokenVerifier } from './token-verifier';

@Injectable()
export class AuthService {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @Inject(IDENTITY_REPOSITORY) private readonly identities: IdentityRepository,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig | null,
  ) {}
  async me(header: string | undefined) {
    const { subject, claims } = await this.verifier.verify(header);
    const metadata = claims.app_metadata as { provider?: unknown; providers?: unknown } | undefined;
    const providers = metadata?.providers;
    // Do not silently link identities or authorize newly enabled provider types.
    if (!Array.isArray(providers) || providers.length !== 1 || providers[0] !== metadata?.provider) {
      throw new ForbiddenException('Access denied');
    }
    if (metadata?.provider === 'email') {
      const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
      const amr = claims.amr;
      const otp = Array.isArray(amr) && amr.some(v => v && typeof v === 'object' && v.method === 'otp');
      if (!this.config?.emailOtpEnabled || !this.config.devEmails.has(email) || !otp) {
        throw new ForbiddenException('Access denied');
      }
    } else if (metadata?.provider !== 'google') {
      throw new ForbiddenException('Access denied');
    }
    let user;
    try { user = await this.identities.getOrCreate(subject); }
    catch { throw new ServiceUnavailableException('Service unavailable'); }
    // Provider role/user metadata never grants application status or permissions.
    if (user.status !== 'ACTIVE' || user.deletionRequestedAt !== null) throw new ForbiddenException('Access denied');
    return { id: user.id, status: user.status, createdAt: user.createdAt, updatedAt: user.updatedAt };
  }
}
