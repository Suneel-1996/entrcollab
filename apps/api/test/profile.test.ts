import 'reflect-metadata';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { AuthService } from '../src/auth/auth.service';
import { AUTH_CONFIG, readAuthConfig } from '../src/auth/auth.config';
import { IDENTITY_REPOSITORY } from '../src/auth/identity.repository';
import { TOKEN_VERIFIER } from '../src/auth/token-verifier';
import { UnauthorizedException } from '@nestjs/common';
import { ProfileController } from '../src/profiles/profile.controller';
import { ProfileService } from '../src/profiles/profile.service';
import { PROFILE_REPOSITORY, type ProfileRecord } from '../src/profiles/profile.repository';
import { parseProfile, PROFILE_FIELDS, type ProfileInput } from '../src/profiles/profile.input';

const owner = '11111111-1111-4111-8111-111111111111';
const reader = '22222222-2222-4222-8222-222222222222';
const absent = '33333333-3333-4333-8333-333333333333';
let app: INestApplication; let failed = false; let state = 'ACTIVE'; let hold: Date | null = null;
let records = new Map<string, ProfileRecord>(); let calls = 0;
const logs: string[] = [];
const config = readAuthConfig({ SUPABASE_URL: 'https://profile-test.example.invalid' });
function record(userId: string, input: ProfileInput): ProfileRecord {
  return { userId, displayName: input.displayName, bio: input.bio, skills: input.skills, interests: input.interests, availability: input.availability,
    displayNameVisibility: input.visibility.displayName, bioVisibility: input.visibility.bio, skillsVisibility: input.visibility.skills,
    interestsVisibility: input.visibility.interests, availabilityVisibility: input.visibility.availability, createdAt: new Date(0), updatedAt: new Date(0) };
}
const profiles = {
  async own(id: string) { calls++; if (failed) throw new Error('DB_PASSWORD TOKEN_SENTINEL'); return records.get(id) ?? null; },
  async member(id: string) { return this.own(id); },
  async replace(id: string, input: ProfileInput) { calls++; if (failed) throw new Error('DB_PASSWORD TOKEN_SENTINEL'); const value = record(id, input); records.set(id, value); return value; },
};
@Module({ controllers: [ProfileController], providers: [AuthService, ProfileService,
  { provide: AUTH_CONFIG, useValue: config },
  { provide: TOKEN_VERIFIER, useValue: { async verify(header: string) {
    const subject = header === 'Bearer owner' ? owner : header === 'Bearer reader' ? reader : null;
    if (!subject) throw new UnauthorizedException('Unauthorized');
    return { subject, claims: { app_metadata: { provider: 'google', providers: ['google'] } } };
  } } },
  { provide: IDENTITY_REPOSITORY, useValue: { async getOrCreate(id: string) { return { id, status: state, deletionRequestedAt: hold, createdAt: new Date(0), updatedAt: new Date(0) }; } } },
  { provide: PROFILE_REPOSITORY, useValue: profiles },
] })
class TestProfileModule {}
before(async () => {
  const collect = (...values: unknown[]) => logs.push(values.map(String).join(' '));
  app = await NestFactory.create(TestProfileModule, { logger: { log: collect, warn: collect, error: collect } });
  app.setGlobalPrefix('api/v1'); await app.init();
});
after(async () => { await app.close(); });
beforeEach(() => { records = new Map(); failed = false; state = 'ACTIVE'; hold = null; calls = 0; });
const api = () => request(app.getHttpServer());
const path = '/api/v1/profiles';
const input = { displayName: ' Builder ', bio: 'private bio', skills: [' TypeScript '], interests: ['Climate'], availability: 'weekends' };

test('all routes deny missing/invalid authentication before querying profiles', async () => {
  for (const header of ['', 'Bearer invalid']) {
    await api().get(`${path}/me`).set('Authorization', header).expect(401);
    await api().put(`${path}/me`).set('Authorization', header).send(input).expect(401);
    await api().get(`${path}/${owner}`).set('Authorization', header).expect(401);
  }
  assert.equal(calls, 0);
});
test('owner creates, restores and replaces a normalized private profile with no leaked columns', async () => {
  const created = await api().put(`${path}/me`).set('Authorization', 'Bearer owner').send(input).expect(200);
  assert.equal(created.body.userId, owner); assert.equal(created.body.displayName, 'Builder'); assert.deepEqual(created.body.skills, ['TypeScript']);
  assert.equal(created.headers['cache-control'], 'no-store');
  for (const field of PROFILE_FIELDS) assert.equal(created.body.visibility[field], 'PRIVATE');
  assert.equal(created.body.providerSubject, undefined); assert.equal(created.body.bioVisibility, undefined);
  const read = await api().get(`${path}/me`).set('Authorization', 'Bearer owner').expect(200); assert.deepEqual(read.body, created.body);
  const replaced = await api().put(`${path}/me`).set('Authorization', 'Bearer owner').send({ displayName: 'New' }).expect(200);
  assert.equal(replaced.body.bio, ''); assert.deepEqual(replaced.body.skills, []);
});
test('a profile is not created implicitly by GET and missing owner profile is 404', async () => {
  await api().get(`${path}/me`).set('Authorization', 'Bearer owner').expect(404); assert.equal(records.size, 0);
});
test('all-private and absent profiles are indistinguishable to other users', async () => {
  await api().put(`${path}/me`).set('Authorization', 'Bearer owner').send(input).expect(200);
  const hidden = await api().get(`${path}/${owner}`).set('Authorization', 'Bearer reader').expect(404);
  const missing = await api().get(`${path}/${absent}`).set('Authorization', 'Bearer reader').expect(404);
  assert.deepEqual(hidden.body, missing.body);
});
for (const field of PROFILE_FIELDS) test(`member response contains only shared ${field}`, async () => {
  await api().put(`${path}/me`).set('Authorization', 'Bearer owner').send({ ...input, visibility: { [field]: 'MEMBERS' } }).expect(200);
  const response = await api().get(`${path}/${owner}`).set('Authorization', 'Bearer reader').expect(200);
  assert.deepEqual(Object.keys(response.body).sort(), ['userId', field].sort());
  assert.equal(response.headers['cache-control'], 'no-store');
  const own = await api().get(`${path}/${owner}`).set('Authorization', 'Bearer owner').expect(200); assert.ok(own.body.visibility);
});
test('visibility changes take effect and omitted visibility resets to PRIVATE on full replacement', async () => {
  await api().put(`${path}/me`).set('Authorization', 'Bearer owner').send({ ...input, visibility: { displayName: 'MEMBERS' } }).expect(200);
  await api().get(`${path}/${owner}`).set('Authorization', 'Bearer reader').expect(200);
  await api().put(`${path}/me`).set('Authorization', 'Bearer owner').send(input).expect(200);
  await api().get(`${path}/${owner}`).set('Authorization', 'Bearer reader').expect(404);
});
test('owner/userId and unknown fields cannot override server-derived ownership', async () => {
  for (const key of ['userId', 'ownerId', 'providerSubject', 'status', 'role', 'unexpected']) {
    await api().put(`${path}/me`).set('Authorization', 'Bearer reader').send({ ...input, [key]: owner }).expect(400);
  }
  assert.equal(records.size, 0);
  await api().put(`${path}/${owner}`).set('Authorization', 'Bearer reader').send(input).expect(404);
  await api().put(`${path}/me`).set('Authorization', 'Bearer reader').send(input).expect(200);
  assert.equal(records.has(owner), false); assert.equal(records.has(reader), true);
});
test('strict validation rejects bad types, excess lengths, invalid visibility and duplicate tags without writing', async () => {
  const invalid: unknown[] = [null, [], {}, { displayName: ' ' }, { ...input, displayName: 'a'.repeat(81) }, { ...input, bio: 'a'.repeat(2001) },
    { ...input, availability: 'a'.repeat(201) }, { ...input, bio: null }, { ...input, skills: null }, { ...input, interests: 'tag' },
    { ...input, skills: ['A', ' a '] }, { ...input, interests: ['Ａ', 'a'] }, { ...input, skills: [' '] }, { ...input, interests: [1] },
    { ...input, skills: ['a'.repeat(51)] }, { ...input, skills: Array.from({ length: 21 }, (_, i) => String(i)) },
    { ...input, visibility: null }, { ...input, visibility: [] }, { ...input, visibility: { bio: 'PUBLIC' } },
    { ...input, visibility: { bio: null } }, { ...input, visibility: { email: 'MEMBERS' } }, { ...input, bio: 'bad\u0000value' }];
  for (const body of invalid) assert.throws(() => parseProfile(body), { message: 'Invalid profile' });
  await api().put(`${path}/me`).set('Authorization', 'Bearer owner').send({ ...input, visibility: { bio: 'PUBLIC' } }).expect(400);
  assert.equal(calls, 0);
});
test('maximum boundaries and multiline Unicode text are accepted', () => {
  const body = parseProfile({ displayName: '🧑'.repeat(80), bio: 'b'.repeat(2000), availability: 'a'.repeat(200), skills: Array.from({ length: 20 }, (_, i) => `${i}`.padEnd(50, 'a')), interests: [], visibility: { bio: 'MEMBERS' } });
  assert.equal(body.visibility.bio, 'MEMBERS'); assert.equal(body.visibility.skills, 'PRIVATE');
  assert.equal(parseProfile({ displayName: 'Name', bio: 'Line 1\nLine 2' }).bio, 'Line 1\nLine 2');
});
test('suspended and deletion-held callers cannot read or write any profile', async () => {
  for (const restricted of ['suspended', 'hold']) {
    state = restricted === 'suspended' ? 'SUSPENDED' : 'ACTIVE'; hold = restricted === 'hold' ? new Date() : null;
    await api().get(`${path}/me`).set('Authorization', 'Bearer owner').expect(403);
    await api().put(`${path}/me`).set('Authorization', 'Bearer owner').send(input).expect(403);
    await api().get(`${path}/${reader}`).set('Authorization', 'Bearer owner').expect(403);
  }
  assert.equal(calls, 0);
});
test('database errors are generic and do not leak profile content or tokens in response/logs', async () => {
  failed = true;
  for (const method of ['get', 'put', 'member']) {
    const response = method === 'put' ? await api().put(`${path}/me`).set('Authorization', 'Bearer owner').send(input).expect(503)
      : await api().get(method === 'member' ? `${path}/${owner}` : `${path}/me`).set('Authorization', 'Bearer reader').expect(503);
    assert.equal(response.body.message, 'Service unavailable'); assert.doesNotMatch(JSON.stringify(response.body), /DB_PASSWORD|TOKEN_SENTINEL|private bio|Bearer owner/);
  }
  assert.doesNotMatch(logs.join('\n'), /DB_PASSWORD|TOKEN_SENTINEL|private bio|Bearer owner/);
});
test('bad target identifiers return a generic validation error', async () => {
  const response = await api().get(`${path}/not-a-uuid`).set('Authorization', 'Bearer reader').expect(400); assert.equal(response.body.message, 'Invalid profile identifier'); assert.equal(calls, 0);
});
