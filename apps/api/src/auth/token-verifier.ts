import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from 'jose';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';

export interface VerifiedIdentity { subject: string; claims: JWTPayload }
export interface TokenVerifier { verify(header: string | undefined): Promise<VerifiedIdentity> }
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class SupabaseTokenVerifier implements TokenVerifier {
  private readonly keys: JWTVerifyGetKey | null;
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig | null, keys?: JWTVerifyGetKey) {
    this.keys = config ? keys ?? createRemoteJWKSet(config.jwksUrl, {
      timeoutDuration: 5000, cooldownDuration: 30_000, cacheMaxAge: 600_000,
    }) : null;
  }
  async verify(header: string | undefined): Promise<VerifiedIdentity> {
    const match = typeof header === 'string' && header.length <= 16_384 && /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header);
    if (!match) throw new UnauthorizedException('Unauthorized');
    if (!this.config || !this.keys) throw new ServiceUnavailableException('Authentication unavailable');
    try {
      const { payload } = await jwtVerify(match[1], this.keys, {
        issuer: this.config.issuer, audience: this.config.audience, algorithms: ['RS256', 'ES256'],
        requiredClaims: ['sub', 'iat', 'exp', 'aud', 'iss'], clockTolerance: 0,
      });
      if (!payload.sub || !UUID.test(payload.sub) || payload.role !== 'authenticated' || payload.is_anonymous === true) {
        throw new UnauthorizedException('Unauthorized');
      }
      return { subject: payload.sub, claims: payload };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof errors.JWKSTimeout || !(error instanceof errors.JOSEError)) {
        throw new ServiceUnavailableException('Authentication unavailable');
      }
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
