import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { AUTH_CONFIG, readAuthConfig } from '../src/auth/auth.config';
import { IDENTITY_REPOSITORY, type ApplicationIdentity } from '../src/auth/identity.repository';
import { SupabaseTokenVerifier, TOKEN_VERIFIER } from '../src/auth/token-verifier';

const config = readAuthConfig({ SUPABASE_URL: 'https://auth.example.invalid', AUTH_EMAIL_OTP_ENABLED: 'true', AUTH_DEV_EMAIL_ALLOWLIST: 'tester@example.invalid' })!;
const subject = 'aa111111-1111-4111-8111-111111111111';
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let other: Awaited<ReturnType<typeof generateKeyPair>>;
let verifier: SupabaseTokenVerifier;
let app: INestApplication;
const users = new Map<string, ApplicationIdentity>();
let failure = false;
let lookups = 0;
const logs: string[] = [];
const repository = {
  async getOrCreate(s: string) {
    lookups++;
    if (failure) throw new Error('DB secret password and TOKEN_SENTINEL');
    if (!users.has(s)) users.set(s, { id: 'bb222222-2222-4222-8222-222222222222', providerSubject: s, status: 'ACTIVE', deletionRequestedAt: null, createdAt: new Date(0), updatedAt: new Date(0) });
    return users.get(s)!;
  },
};
async function token(overrides: JWTPayload = {}, key = keys.privateKey) {
  return new SignJWT({ sub: subject, role: 'authenticated', app_metadata: { provider: 'google', providers: ['google'] }, ...overrides })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' }).setIssuer(String(overrides.iss ?? config.issuer))
    .setAudience(overrides.aud ?? 'authenticated').setIssuedAt().setExpirationTime(overrides.exp ?? '5m').sign(key);
}
@Module({ controllers: [AuthController], providers: [AuthService,
  { provide: AUTH_CONFIG, useValue: config }, { provide: TOKEN_VERIFIER, useFactory: () => verifier },
  { provide: IDENTITY_REPOSITORY, useValue: repository },
] })
class TestAuthModule {}
before(async () => {
  keys = await generateKeyPair('ES256'); other = await generateKeyPair('ES256');
  const jwk = { ...await exportJWK(keys.publicKey), kid: 'test-key', alg: 'ES256' };
  verifier = new SupabaseTokenVerifier(config, createLocalJWKSet({ keys: [jwk] }));
  const collect = (...args: unknown[]) => { logs.push(args.map(String).join(' ')); };
  app = await NestFactory.create(TestAuthModule, { logger: { log: collect, error: collect, warn: collect, debug: collect, verbose: collect } });
  app.setGlobalPrefix('api/v1'); await app.init();
});
after(async () => { await app.close(); });
test('missing/malformed authorization cannot provision a user', async () => {
  const count = lookups;
  for (const header of ['', 'Basic abc', 'Bearer garbage', 'Bearer a.b.c Bearer d.e.f']) {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', header).expect(401);
    assert.equal(res.body.message, 'Unauthorized');
  }
  assert.equal(lookups, count);
});
test('verified first-time and returning user; client identity/role parameters ignored', async () => {
  const jwt = await token({ user_metadata: { role: 'admin', status: 'ACTIVE', id: 'attacker-choice' } });
  const first = await request(app.getHttpServer()).get('/api/v1/auth/me?userId=attacker-choice&role=admin').set('Authorization', `Bearer ${jwt}`).expect(200);
  const second = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${jwt}`).expect(200);
  assert.equal(first.body.id, second.body.id); assert.equal(users.size, 1);
  assert.equal(first.headers['cache-control'], 'no-store');
  assert.deepEqual(Object.keys(first.body).sort(), ['createdAt', 'id', 'status', 'updatedAt']);
});
for (const [name, claims] of [
  ['expired', { exp: Math.floor(Date.now() / 1000) - 30 }],
  ['wrong issuer', { iss: 'https://attacker.invalid/auth/v1' }],
  ['wrong audience', { aud: 'service_role' }],
  ['not yet valid', { nbf: Math.floor(Date.now() / 1000) + 300 }],
  ['bad subject', { sub: 'not-a-uuid' }],
  ['privileged role', { role: 'service_role' }],
  ['anonymous user', { is_anonymous: true }],
] as [string, JWTPayload][]) test(`reject ${name} token before database access`, async () => {
  const count = lookups;
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${await token(claims)}`).expect(401);
  assert.equal(lookups, count);
});
test('invalid signature', async () => {
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${await token({}, other.privateKey)}`).expect(401);
});
test('reject HMAC/algorithm confusion and missing expiry', async () => {
  const jwt = await new SignJWT({ sub: subject }).setProtectedHeader({ alg: 'HS256' }).setIssuer(config.issuer).setAudience('authenticated').setIssuedAt().setExpirationTime('5m').sign(new Uint8Array(32));
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${jwt}`).expect(401);
  const noExpiry = await new SignJWT({ sub: subject }).setProtectedHeader({ alg: 'ES256', kid: 'test-key' }).setIssuer(config.issuer).setAudience('authenticated').setIssuedAt().sign(keys.privateKey);
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${noExpiry}`).expect(401);
});
test('unknown provider and linked identities rejected without provisioning', async () => {
  const count = lookups;
  for (const metadata of [{ provider: 'github', providers: ['github'] }, { provider: 'google', providers: ['google', 'email'] }, { provider: 'google' }]) {
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${await token({ app_metadata: metadata })}`).expect(403);
  }
  assert.equal(lookups, count);
});
test('email OTP is allowlisted and password sign-in is not accepted', async () => {
  const claims = { email: 'tester@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, amr: [{ method: 'otp', timestamp: 0 }] };
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${await token(claims)}`).expect(200);
  for (const change of [{ email: 'external@example.invalid' }, { amr: [{ method: 'password' }] }]) {
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${await token({ ...claims, ...change })}`).expect(403);
  }
  const disabled = new AuthService(verifier, repository, { ...config, emailOtpEnabled: false });
  await assert.rejects(disabled.me(`Bearer ${await token(claims)}`), { status: 403 });
});
test('suspension and deletion hold enforced without reactivation', async () => {
  const user = users.get(subject)!;
  user.status = 'SUSPENDED';
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${await token()}`).expect(403);
  assert.equal(user.status, 'SUSPENDED');
  user.status = 'ACTIVE'; user.deletionRequestedAt = new Date();
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${await token()}`).expect(403);
  user.deletionRequestedAt = null;
});
test('database failures and response/logs never expose tokens or internal errors', async () => {
  failure = true; const jwt = await token({ marker: 'TOKEN_SENTINEL' });
  try {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${jwt}`).expect(503);
    assert.equal(response.body.message, 'Service unavailable');
    const output = JSON.stringify(response.body) + logs.join('\n');
    assert.ok(!output.includes(jwt)); assert.ok(!output.includes('TOKEN_SENTINEL')); assert.ok(!output.includes('DB secret'));
  } finally { failure = false; }
});
test('provider/JWKS outage is 503, unavailable configuration fails closed', async () => {
  const unavailable = new SupabaseTokenVerifier(config, async () => { throw new TypeError('NETWORK_TOKEN_SENTINEL'); });
  await assert.rejects(unavailable.verify(`Bearer ${await token()}`), { status: 503, message: 'Authentication unavailable' });
  await assert.rejects(new SupabaseTokenVerifier(null).verify(`Bearer ${await token()}`), { status: 503 });
});
test('auth configuration rejects insecure URL and unsafe OTP activation', () => {
  assert.equal(readAuthConfig({}), null);
  for (const SUPABASE_URL of ['http://example.invalid', 'https://user:pass@example.invalid', 'https://example.invalid/path']) assert.throws(() => readAuthConfig({ SUPABASE_URL }));
  assert.throws(() => readAuthConfig({ SUPABASE_URL: 'https://example.invalid', AUTH_EMAIL_OTP_ENABLED: 'true' }));
  assert.throws(() => readAuthConfig({ SUPABASE_URL: 'https://example.invalid', AUTH_EMAIL_OTP_ENABLED: 'true', AUTH_DEV_EMAIL_ALLOWLIST: 'tester@example.invalid', NODE_ENV: 'production' }));
});
