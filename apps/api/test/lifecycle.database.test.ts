import 'reflect-metadata';
import 'dotenv/config';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { DatabaseService } from '../src/database.service';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { AUTH_CONFIG, readAuthConfig } from '../src/auth/auth.config';
import { IDENTITY_REPOSITORY, PrismaIdentityRepository } from '../src/auth/identity.repository';
import { TOKEN_VERIFIER, SupabaseTokenVerifier } from '../src/auth/token-verifier';
import { ProfileController } from '../src/profiles/profile.controller';
import { ProfileService } from '../src/profiles/profile.service';
import { PROFILE_REPOSITORY, PrismaProfileRepository } from '../src/profiles/profile.repository';
import { PROFILE_FIELDS } from '../src/profiles/profile.input';

const db = new DatabaseService();
const config = readAuthConfig({ SUPABASE_URL: 'https://lifecycle-test.example.invalid' })!;
let app: INestApplication;
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let wrongKeys: Awaited<ReturnType<typeof generateKeyPair>>;
let verifier: SupabaseTokenVerifier;
let subjects: string[] = [];
let owner: { id: string; subject: string; token: string };
let members: { id: string; subject: string; token: string }[] = [];
const logs: string[] = [];
const privateValues = { displayName: 'Fixture display', bio: 'PRIVATE_BIO_SENTINEL', skills: ['PRIVATE_SKILL_SENTINEL'], interests: ['PRIVATE_INTEREST_SENTINEL'], availability: 'PRIVATE_TIME_SENTINEL' };
async function signed(subject: string, overrides: JWTPayload = {}, key = keys.privateKey) {
  return new SignJWT({ sub: subject, role: 'authenticated', app_metadata: { provider: 'google', providers: ['google'] }, ...overrides })
    .setProtectedHeader({ alg: 'ES256', kid: 'ephemeral-test-key' }).setIssuer(String(overrides.iss ?? config.issuer)).setAudience(overrides.aud ?? 'authenticated').setIssuedAt().setExpirationTime(overrides.exp ?? '5m').sign(key);
}
@Module({ controllers: [AuthController, ProfileController], providers: [AuthService, ProfileService,
  { provide: DatabaseService, useValue: db }, { provide: AUTH_CONFIG, useValue: config },
  { provide: TOKEN_VERIFIER, useFactory: () => verifier },
  { provide: IDENTITY_REPOSITORY, useClass: PrismaIdentityRepository },
  { provide: PROFILE_REPOSITORY, useClass: PrismaProfileRepository },
] })
class IntegrationModule {}
const api = () => request(app.getHttpServer());
async function actor() {
  const subject = randomUUID(); subjects.push(subject); const token = await signed(subject);
  const response = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { subject, token, id: String(response.body.id) };
}
async function put(token: string, body: object = privateValues, status = 200) {
  return api().put('/api/v1/profiles/me').set('Authorization', `Bearer ${token}`).send(body).expect(status);
}
before(async () => {
  keys = await generateKeyPair('ES256'); wrongKeys = await generateKeyPair('ES256');
  verifier = new SupabaseTokenVerifier(config, createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: 'ephemeral-test-key', alg: 'ES256' }] }));
  const collect = (...values: unknown[]) => { logs.push(values.map(String).join(' ')); };
  app = await NestFactory.create(IntegrationModule, { logger: { log: collect, error: collect, warn: collect } });
  app.setGlobalPrefix('api/v1'); await app.listen(0, '127.0.0.1');
});
beforeEach(async () => { subjects = []; owner = await actor(); members = [await actor(), await actor()]; });
afterEach(async () => {
  // Fixture cleanup only: never erase non-test accounts or implement deletion policy.
  await db.profile.deleteMany({ where: { user: { providerSubject: { in: subjects } } } });
  await db.applicationUser.deleteMany({ where: { providerSubject: { in: subjects } } });
});
after(async () => { await app.close(); });

test('all 32 field visibility combinations enforce exact projections for two independent members', async () => {
  for (let mask = 0; mask < 32; mask++) {
    const visibility = Object.fromEntries(PROFILE_FIELDS.map((field, i) => [field, mask & (1 << i) ? 'MEMBERS' : 'PRIVATE']));
    const saved = await put(owner.token, { ...privateValues, visibility });
    assert.equal(saved.headers['cache-control'], 'no-store');
    const own = await api().get('/api/v1/profiles/me').set('Authorization', `Bearer ${owner.token}`).expect(200);
    assert.deepEqual(own.body.visibility, visibility);
    for (const member of members) {
      const response = await api().get(`/api/v1/profiles/${owner.id}`).set('Authorization', `Bearer ${member.token}`).expect(mask ? 200 : 404);
      if (!mask) continue;
      const expected = Object.fromEntries(PROFILE_FIELDS.filter((_, i) => mask & (1 << i)).map(field => [field, privateValues[field]]));
      assert.deepEqual(response.body, { userId: owner.id, ...expected });
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(Object.hasOwn(response.body, 'providerSubject'), false); assert.equal(Object.hasOwn(response.body, 'visibility'), false);
    }
  }
});

test('caller and target state matrix distinguishes denied callers without revealing restricted targets', async () => {
  await put(owner.token, { ...privateValues, visibility: { displayName: 'MEMBERS' } });
  const viewer = members[0];
  for (const callerState of ['ACTIVE', 'SUSPENDED', 'HOLD'] as const) {
    await db.applicationUser.update({ where: { id: viewer.id }, data: { status: callerState === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE', deletionRequestedAt: callerState === 'HOLD' ? new Date() : null } });
    for (const targetState of ['ACTIVE', 'SUSPENDED', 'HOLD'] as const) {
      await db.applicationUser.update({ where: { id: owner.id }, data: { status: targetState === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE', deletionRequestedAt: targetState === 'HOLD' ? new Date() : null } });
      const expected = callerState !== 'ACTIVE' ? 403 : targetState !== 'ACTIVE' ? 404 : 200;
      const response = await api().get(`/api/v1/profiles/${owner.id}`).set('Authorization', `Bearer ${viewer.token}`).expect(expected);
      if (expected !== 200) assert.doesNotMatch(JSON.stringify(response.body), /PRIVATE_.*SENTINEL|providerSubject|deletionRequestedAt/);
      if (expected === 404) {
        const missing = await api().get(`/api/v1/profiles/${randomUUID()}`).set('Authorization', `Bearer ${viewer.token}`).expect(404);
        assert.deepEqual(response.body, missing.body);
      }
    }
  }
});

test('withdrawing sharing takes effect on the next member request with no data/cache leak', async () => {
  await put(owner.token, { ...privateValues, visibility: { bio: 'MEMBERS' } });
  const visible = await api().get(`/api/v1/profiles/${owner.id}`).set('Authorization', `Bearer ${members[0].token}`).expect(200);
  assert.equal(visible.body.bio, privateValues.bio); assert.equal(visible.headers['cache-control'], 'no-store');
  await put(owner.token, privateValues);
  const hidden = await api().get(`/api/v1/profiles/${owner.id}`).set('Authorization', `Bearer ${members[0].token}`).expect(404);
  assert.doesNotMatch(JSON.stringify(hidden.body), /PRIVATE_BIO_SENTINEL/);
  assert.equal((await db.profile.findUniqueOrThrow({ where: { userId: owner.id } })).bio, privateValues.bio);
});

test('old valid tokens cannot reactivate suspended or deletion-held owners or overwrite their profiles', async () => {
  await put(owner.token); const before = await db.profile.findUniqueOrThrow({ where: { userId: owner.id } });
  for (const restricted of ['SUSPENDED', 'HOLD'] as const) {
    const deletionRequestedAt = restricted === 'HOLD' ? new Date('2020-01-01T00:00:00Z') : null;
    await db.applicationUser.update({ where: { id: owner.id }, data: { status: restricted === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE', deletionRequestedAt } });
    const forgedStatus = await signed(owner.subject, { user_metadata: { status: 'ACTIVE', role: 'admin', id: members[0].id } });
    for (const token of [owner.token, forgedStatus]) {
      await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(403);
      await api().get('/api/v1/profiles/me').set('Authorization', `Bearer ${token}`).expect(403);
      await put(token, { displayName: 'Unauthorized replacement' }, 403);
    }
    const account = await db.applicationUser.findUniqueOrThrow({ where: { id: owner.id } });
    assert.equal(account.status, restricted === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE');
    assert.equal(account.deletionRequestedAt?.toISOString() ?? null, deletionRequestedAt?.toISOString() ?? null);
    assert.deepEqual(await db.profile.findUniqueOrThrow({ where: { userId: owner.id } }), before);
  }
});

test('identity and field injection cannot change another owner or bypass visibility', async () => {
  await put(owner.token);
  for (const key of ['userId', 'ownerId', 'providerSubject', 'status', 'role']) await put(members[0].token, { displayName: 'Attacker', [key]: owner.id }, 400);
  await api().put(`/api/v1/profiles/${owner.id}`).set('Authorization', `Bearer ${members[0].token}`).send({ displayName: 'Attacker' }).expect(404);
  assert.equal(await db.profile.count({ where: { userId: members[0].id } }), 0);
  assert.equal((await db.profile.findUniqueOrThrow({ where: { userId: owner.id } })).displayName, privateValues.displayName);
});

test('expired, invalid signature/issuer/audience and anonymous credentials cannot read or write profiles', async () => {
  await put(owner.token);
  const tokens = [undefined, 'not-a-token', await signed(owner.subject, { exp: Math.floor(Date.now() / 1000) - 10 }), await signed(owner.subject, {}, wrongKeys.privateKey), await signed(owner.subject, { iss: 'https://wrong.example.invalid/auth/v1' }), await signed(owner.subject, { aud: 'other' }), await signed(owner.subject, { is_anonymous: true })];
  for (const token of tokens) {
    const header = token ? `Bearer ${token}` : '';
    await api().get('/api/v1/profiles/me').set('Authorization', header).expect(401);
    await api().get(`/api/v1/profiles/${owner.id}`).set('Authorization', header).expect(401);
    await api().put('/api/v1/profiles/me').set('Authorization', header).send(privateValues).expect(401);
  }
});

test('concurrent first HTTP logins reuse exactly one application identity without creating a profile', async () => {
  const subject = randomUUID(); subjects.push(subject); const token = await signed(subject);
  const responses = await Promise.all(Array.from({ length: 12 }, () => api().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200)));
  assert.equal(new Set(responses.map(response => response.body.id)).size, 1);
  const id = String(responses[0].body.id); assert.notEqual(id, subject);
  assert.equal(await db.applicationUser.count({ where: { providerSubject: subject } }), 1);
  assert.equal(await db.profile.count({ where: { userId: id } }), 0);
});

test('unapproved linking/deletion/recovery routes are absent and a deletion hold does not erase fixture data', async () => {
  await put(owner.token);
  for (const path of ['/api/v1/auth/link', '/api/v1/auth/recover', '/api/v1/auth/delete']) await api().post(path).set('Authorization', `Bearer ${owner.token}`).send({}).expect(404);
  await api().delete('/api/v1/profiles/me').set('Authorization', `Bearer ${owner.token}`).expect(404);
  await db.applicationUser.update({ where: { id: owner.id }, data: { deletionRequestedAt: new Date() } });
  await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${owner.token}`).expect(403);
  assert.equal(await db.profile.count({ where: { userId: owner.id } }), 1);
  assert.equal(await db.applicationUser.count({ where: { id: owner.id } }), 1);
});

test('linked-provider credentials cannot provision or expose a profile; logs contain no tokens/private fields', async () => {
  const subject = randomUUID(); subjects.push(subject);
  const token = await signed(subject, { app_metadata: { provider: 'google', providers: ['google', 'email'] } });
  const response = await api().get(`/api/v1/profiles/${owner.id}`).set('Authorization', `Bearer ${token}`).expect(403);
  assert.equal(await db.applicationUser.count({ where: { providerSubject: subject } }), 0);
  assert.doesNotMatch(JSON.stringify(response.body), /PRIVATE_|providerSubject/);
  const output = logs.join('\n'); assert.equal(output.includes(token), false); assert.doesNotMatch(output, /PRIVATE_BIO_SENTINEL|PRIVATE_SKILL_SENTINEL/);
});

test('same-email claims and client metadata never merge distinct provider subjects or transfer profile ownership', async () => {
  await put(owner.token);
  const email = 'same-email-fixture@example.invalid';
  const ownerToken = await signed(owner.subject, { email });
  const memberToken = await signed(members[0].subject, { email, user_metadata: { userId: owner.id, providerSubject: owner.subject } });
  const first = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${ownerToken}`).expect(200);
  const second = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${memberToken}`).expect(200);
  assert.equal(first.body.id, owner.id); assert.equal(second.body.id, members[0].id); assert.notEqual(first.body.id, second.body.id);
  await api().get('/api/v1/profiles/me').set('Authorization', `Bearer ${memberToken}`).expect(404);
  await api().get(`/api/v1/profiles/${owner.id}`).set('Authorization', `Bearer ${memberToken}`).expect(404);
  assert.equal(await db.applicationUser.count({ where: { id: { in: [owner.id, members[0].id] } } }), 2);
});
