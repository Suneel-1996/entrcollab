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
import { IdeaController } from '../src/ideas/idea.controller';
import { IdeaService } from '../src/ideas/idea.service';
import { IDEA_REPOSITORY, PrismaIdeaRepository } from '../src/ideas/idea.repository';
import { nextCursor } from '../src/ideas/idea.input';
import type { IdeaProjectStatus, IdeaProjectVisibility } from '@prisma/client';
const db = new DatabaseService();
const config = readAuthConfig({ SUPABASE_URL: 'https://idea-visibility-test.example.invalid' })!;
let app: INestApplication; let verifier: SupabaseTokenVerifier;
let keys: Awaited<ReturnType<typeof generateKeyPair>>; let wrong: Awaited<ReturnType<typeof generateKeyPair>>;
let subjects: string[] = []; let owner: Actor; let member: Actor; let secondMember: Actor;
const logs: string[] = [];
interface Actor { id: string; subject: string; token: string }
const content = { title: 'Private idea fixture', summary: 'Summary', description: 'PRIVATE_IDEA_SENTINEL', neededSkills: ['TypeScript'], tags: ['Climate'] };
async function token(subject: string, overrides: JWTPayload = {}, key = keys.privateKey) {
  return new SignJWT({ sub: subject, role: 'authenticated', app_metadata: { provider: 'google', providers: ['google'] }, ...overrides }).setProtectedHeader({ alg: 'ES256', kid: 'local-test-key' }).setIssuer(String(overrides.iss ?? config.issuer)).setAudience(overrides.aud ?? 'authenticated').setIssuedAt().setExpirationTime(overrides.exp ?? '5m').sign(key);
}
@Module({ controllers: [AuthController, IdeaController], providers: [AuthService, IdeaService,
  { provide: DatabaseService, useValue: db }, { provide: AUTH_CONFIG, useValue: config }, { provide: TOKEN_VERIFIER, useFactory: () => verifier },
  { provide: IDENTITY_REPOSITORY, useClass: PrismaIdentityRepository }, { provide: IDEA_REPOSITORY, useClass: PrismaIdeaRepository },
] }) class IntegrationModule {}
const api = () => request(app.getHttpServer());
const base = '/api/v1/ideas';
async function actor(): Promise<Actor> {
  const subject = randomUUID(); subjects.push(subject); const bearer = await token(subject);
  const response = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${bearer}`).expect(200);
  return { id: String(response.body.id), subject, token: bearer };
}
async function create(input: object = content, caller = owner) { return api().post(base).set('Authorization', `Bearer ${caller.token}`).send(input).expect(201); }
async function action(id: string, name: 'publish' | 'archive', status = 200, caller = owner) { return api().post(`${base}/${id}/${name}`).set('Authorization', `Bearer ${caller.token}`).send({}).expect(status); }
before(async () => {
  keys = await generateKeyPair('ES256'); wrong = await generateKeyPair('ES256');
  verifier = new SupabaseTokenVerifier(config, createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: 'local-test-key', alg: 'ES256' }] }));
  const collect = (...values: unknown[]) => { logs.push(values.map(String).join(' ')); };
  app = await NestFactory.create(IntegrationModule, { logger: { log: collect, error: collect, warn: collect } });
  app.setGlobalPrefix('api/v1'); await app.listen(0, '127.0.0.1');
});
beforeEach(async () => { subjects = []; owner = await actor(); member = await actor(); secondMember = await actor(); });
afterEach(async () => {
  await db.ideaProject.deleteMany({ where: { owner: { providerSubject: { in: subjects } } } });
  await db.applicationUser.deleteMany({ where: { providerSubject: { in: subjects } } });
});
after(async () => { await app.close(); });

const ownerKeys = ['id', 'ownerId', 'title', 'summary', 'description', 'neededSkills', 'tags', 'status', 'visibility', 'createdAt', 'updatedAt', 'publishedAt', 'archivedAt'].sort();
const memberKeys = ownerKeys.filter(key => !['status', 'visibility', 'archivedAt'].includes(key));
type AccountState = 'ACTIVE' | 'SUSPENDED' | 'HOLD';
async function account(caller: Actor, state: AccountState) {
  await db.applicationUser.update({ where: { id: caller.id }, data: { status: state === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE', deletionRequestedAt: state === 'HOLD' ? new Date() : null } });
}
async function fixtures(caller = owner) {
  const rows: { id: string; status: IdeaProjectStatus; visibility: IdeaProjectVisibility }[] = [];
  for (const visibility of ['PRIVATE', 'MEMBERS'] as const) for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const) {
    const response = await create({ ...content, visibility }, caller); const id = String(response.body.id);
    if (status === 'PUBLISHED') await action(id, 'publish', 200, caller);
    if (status === 'ARCHIVED') { await action(id, 'publish', 200, caller); await action(id, 'archive', 200, caller); }
    rows.push({ id, status, visibility });
  }
  return rows;
}
function noSensitive(body: unknown, actors = [owner, member, secondMember]) {
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /providerSubject|deletionRequestedAt|access_token|refresh_token|PRIVATE_IDEA_SENTINEL/);
  for (const caller of actors) { assert.equal(serialized.includes(caller.token), false); assert.equal(serialized.includes(caller.subject), false); }
}

test('complete owner/two-member/anonymous read matrix enforces exact projections and uniform hidden responses', async () => {
  const rows = await fixtures();
  const absent = await api().get(`${base}/${randomUUID()}`).set('Authorization', `Bearer ${member.token}`).expect(404);
  for (const row of rows) {
    const own = await api().get(`${base}/${row.id}`).set('Authorization', `Bearer ${owner.token}`).expect(200);
    assert.deepEqual(Object.keys(own.body).sort(), ownerKeys); assert.equal(own.body.status, row.status); assert.equal(own.body.visibility, row.visibility);
    assert.equal(own.headers['cache-control'], 'no-store'); assert.equal(own.body.description, content.description);
    for (const caller of [member, secondMember]) {
      const shared = row.status === 'PUBLISHED' && row.visibility === 'MEMBERS';
      const response = await api().get(`${base}/${row.id}`).set('Authorization', `Bearer ${caller.token}`).expect(shared ? 200 : 404);
      if (shared) { assert.deepEqual(Object.keys(response.body).sort(), memberKeys); assert.equal(response.body.ownerId, owner.id); assert.equal(response.headers['cache-control'], 'no-store'); }
      else { assert.deepEqual(response.body, absent.body); noSensitive(response.body); }
    }
    const anonymous = await api().get(`${base}/${row.id}`).expect(401); noSensitive(anonymous.body);
  }
});

test('caller and owner suspension/hold matrix applies to every lifecycle and visibility, including stale JWTs', async () => {
  const rows = await fixtures();
  for (const target of ['ACTIVE', 'SUSPENDED', 'HOLD'] as const) {
    await account(owner, target);
    await api().get(base).set('Authorization', `Bearer ${owner.token}`).expect(target === 'ACTIVE' ? 200 : 403);
    for (const callerState of ['ACTIVE', 'SUSPENDED', 'HOLD'] as const) {
      await account(member, callerState);
      for (const row of rows) {
        const expected = callerState !== 'ACTIVE' ? 403 : target === 'ACTIVE' && row.status === 'PUBLISHED' && row.visibility === 'MEMBERS' ? 200 : 404;
        const response = await api().get(`${base}/${row.id}`).set('Authorization', `Bearer ${member.token}`).expect(expected);
        if (expected !== 200) noSensitive(response.body);
        const own = await api().get(`${base}/${row.id}`).set('Authorization', `Bearer ${owner.token}`).expect(target === 'ACTIVE' ? 200 : 403);
        if (target !== 'ACTIVE') noSensitive(own.body);
      }
    }
  }
  const persisted = await db.ideaProject.findMany({ where: { ownerId: owner.id } });
  assert.equal(persisted.length, 6); for (const row of persisted) { const fixture = rows.find(v => v.id === row.id)!; assert.equal(row.status, fixture.status); assert.equal(row.visibility, fixture.visibility); }
  const savedOwner = await db.applicationUser.findUniqueOrThrow({ where: { id: owner.id } }); assert.equal(savedOwner.status, 'ACTIVE'); assert.ok(savedOwner.deletionRequestedAt);
});

test('all list filters and cursor pages remain owner-only even when publications are shared', async () => {
  const foreign = await fixtures(); const local = await fixtures(member);
  for (const filter of [undefined, 'DRAFT', 'PUBLISHED', 'ARCHIVED'] as const) {
    let cursor: string | undefined; const seen: string[] = [];
    do {
      const response = await api().get(base).query({ limit: '1', ...(filter ? { status: filter } : {}), ...(cursor ? { cursor } : {}) }).set('Authorization', `Bearer ${member.token}`).expect(200);
      assert.equal(response.headers['cache-control'], 'no-store'); assert.ok(response.body.items.length <= 1);
      for (const row of response.body.items) { assert.equal(row.ownerId, member.id); assert.equal(foreign.some(v => v.id === row.id), false); assert.deepEqual(Object.keys(row).sort(), ownerKeys); seen.push(String(row.id)); }
      cursor = response.body.nextCursor ?? undefined;
      if (cursor) { const position = JSON.parse(Buffer.from(cursor, 'base64url').toString()); assert.equal(position.ownerId, member.id); assert.equal(position.status, filter ?? null); }
      assert.ok(seen.length <= 6, 'paging must progress');
    } while (cursor);
    assert.deepEqual(new Set(seen), new Set(local.filter(v => !filter || v.status === filter).map(v => v.id))); assert.equal(seen.length, new Set(seen).size);
  }
  const empty = await api().get(base).set('Authorization', `Bearer ${secondMember.token}`).expect(200); assert.deepEqual(empty.body, { items: [], nextCursor: null });
  const first = await api().get(base).query({ limit: '1' }).set('Authorization', `Bearer ${owner.token}`).expect(200);
  const cross = await api().get(base).query({ cursor: first.body.nextCursor }).set('Authorization', `Bearer ${member.token}`).expect(400); noSensitive(cross.body);
  // Forging a caller-scoped position at a foreign row never makes that row readable/listable.
  const forged = nextCursor(member.id, undefined, { id: foreign[0].id, updatedAt: new Date('2099-01-01T00:00:00.000Z') });
  const bounded = await api().get(base).query({ cursor: forged }).set('Authorization', `Bearer ${member.token}`).expect(200);
  assert.equal(bounded.body.items.length, 6); assert.ok(bounded.body.items.every((row: { ownerId: string }) => row.ownerId === member.id));
  for (const key of ['ownerId', 'visibility', 'includeArchived', 'public', 'unlisted', 'search']) await api().get(base).query({ [key]: owner.id }).set('Authorization', `Bearer ${member.token}`).expect(400);
});

test('read permission never grants mutation; spoofed identities and query/header hints cannot expand visibility', async () => {
  const rows = await fixtures();
  const spoof = await token(member.subject, { user_metadata: { id: owner.id, ownerId: owner.id, status: 'ACTIVE', role: 'admin' }, app_metadata: { provider: 'google', providers: ['google'], role: 'owner', ownerId: owner.id } });
  const beforeRows = await db.ideaProject.findMany({ where: { ownerId: owner.id }, orderBy: { id: 'asc' } });
  for (const row of rows) {
    const missingId = randomUUID();
    for (const method of ['put', 'post'] as const) {
      const routes = method === 'put' ? ['',] : ['/publish', '/archive'];
      for (const suffix of routes) {
        const response = await api()[method](`${base}/${row.id}${suffix}`).set('Authorization', `Bearer ${spoof}`).set('X-User-Id', owner.id).send(method === 'put' ? { ...content, visibility: 'MEMBERS' } : {}).expect(404);
        const absent = await api()[method](`${base}/${missingId}${suffix}`).set('Authorization', `Bearer ${spoof}`).send(method === 'put' ? content : {}).expect(404);
        assert.deepEqual(response.body, absent.body); noSensitive(response.body);
      }
    }
    const shared = row.status === 'PUBLISHED' && row.visibility === 'MEMBERS';
    await api().get(`${base}/${row.id}`).query({ ownerId: owner.id, visibility: 'PUBLIC', token: owner.token }).set('X-User-Id', owner.id).set('Authorization', `Bearer ${spoof}`).expect(shared ? 200 : 404);
    const unauthenticated = await api().get(`${base}/${row.id}`).query({ access_token: owner.token }).set('X-User-Id', owner.id).expect(401); noSensitive(unauthenticated.body);
  }
  assert.deepEqual(await db.ideaProject.findMany({ where: { ownerId: owner.id }, orderBy: { id: 'asc' } }), beforeRows);
  assert.ok(!logs.join('\n').includes(spoof));
});

test('sharing withdrawal and archive revoke subsequent conditional reads for both independent members', async () => {
  const response = await create({ ...content, visibility: 'MEMBERS' }); const id = String(response.body.id);
  const missing = await api().get(`${base}/${randomUUID()}`).set('Authorization', `Bearer ${member.token}`).expect(404);
  // A preselected sharing preference is not a publication.
  for (const caller of [member, secondMember]) await api().get(`${base}/${id}`).set('Authorization', `Bearer ${caller.token}`).expect(404);
  const published = await action(id, 'publish'); const etags: (string | undefined)[] = [];
  for (const caller of [member, secondMember]) { const read = await api().get(`${base}/${id}`).set('Authorization', `Bearer ${caller.token}`).expect(200); etags.push(read.headers.etag); assert.equal(read.headers['cache-control'], 'no-store'); }
  await api().put(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).send({ ...content, visibility: 'PRIVATE' }).expect(200);
  for (let i = 0; i < 2; i++) {
    const hidden = await api().get(`${base}/${id}`).set('Authorization', `Bearer ${[member, secondMember][i].token}`).set('If-None-Match', etags[i] ?? '*').expect(404); assert.deepEqual(hidden.body, missing.body); noSensitive(hidden.body);
  }
  await api().put(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).send({ ...content, visibility: 'MEMBERS' }).expect(200);
  for (const caller of [member, secondMember]) await api().get(`${base}/${id}`).set('Authorization', `Bearer ${caller.token}`).expect(200);
  const archived = await action(id, 'archive'); assert.equal(archived.body.visibility, 'MEMBERS'); assert.equal(archived.body.publishedAt, published.body.publishedAt);
  for (const caller of [member, secondMember]) { const hidden = await api().get(`${base}/${id}`).set('Authorization', `Bearer ${caller.token}`).set('If-None-Match', '*').expect(404); assert.deepEqual(hidden.body, missing.body); }
  const own = await api().get(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).expect(200); assert.equal(own.body.status, 'ARCHIVED'); assert.equal(own.body.description, content.description); assert.equal(own.headers['cache-control'], 'no-store');
  const draft = await create({ ...content, visibility: 'MEMBERS' }); await action(String(draft.body.id), 'archive');
  for (const caller of [member, secondMember]) await api().get(`${base}/${draft.body.id}`).set('Authorization', `Bearer ${caller.token}`).expect(404);
});

test('unapproved PUBLIC/UNLISTED/UNPUBLISHED and restore/delete interfaces remain absent without writes', async () => {
  const created = await create({ ...content, visibility: 'MEMBERS' }); const id = String(created.body.id); await action(id, 'publish');
  const beforeRow = await db.ideaProject.findUniqueOrThrow({ where: { id } }); const count = await db.ideaProject.count({ where: { ownerId: owner.id } });
  for (const visibility of ['PUBLIC', 'UNLISTED', 'public', 'unlisted']) {
    await api().post(base).set('Authorization', `Bearer ${owner.token}`).send({ ...content, visibility }).expect(400);
    await api().put(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).send({ ...content, visibility }).expect(400);
  }
  await api().put(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).send({ ...content, status: 'UNPUBLISHED' }).expect(400);
  for (const status of ['UNPUBLISHED', 'PUBLIC', 'UNLISTED']) await api().get(base).query({ status }).set('Authorization', `Bearer ${owner.token}`).expect(400);
  for (const actionName of ['unpublish', 'restore', 'share']) await api().post(`${base}/${id}/${actionName}`).set('Authorization', `Bearer ${owner.token}`).send({}).expect(404);
  await api().delete(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).expect(404);
  await api().patch(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).send({ visibility: 'PUBLIC' }).expect(404);
  assert.deepEqual(await db.ideaProject.findUniqueOrThrow({ where: { id } }), beforeRow); assert.equal(await db.ideaProject.count({ where: { ownerId: owner.id } }), count);
});

test('every endpoint denies invalid credentials before revealing content or permitting writes', async () => {
  const created = await create({ ...content, visibility: 'MEMBERS' }); const id = String(created.body.id); await action(id, 'publish');
  const beforeRow = await db.ideaProject.findUniqueOrThrow({ where: { id } });
  const credentials = [undefined, 'Bearer not-a-jwt', `Bearer ${await token(owner.subject, { exp: Math.floor(Date.now() / 1000) - 60 })}`, `Bearer ${await token(owner.subject, {}, wrong.privateKey)}`, `Bearer ${await token(owner.subject, { iss: 'https://wrong.example.invalid/auth/v1' })}`, `Bearer ${await token(owner.subject, { aud: 'another-client' })}`];
  for (const header of credentials) for (const [method, path, input] of [['get', base, undefined], ['get', `${base}/${id}`, undefined], ['post', base, content], ['put', `${base}/${id}`, content], ['post', `${base}/${id}/publish`, {}], ['post', `${base}/${id}/archive`, {}]] as const) {
    const call = api()[method](path); if (header) call.set('Authorization', header); if (input) call.send(input);
    const response = await call.expect(401); noSensitive(response.body); if (header) assert.ok(!JSON.stringify(response.body).includes(header));
  }
  assert.deepEqual(await db.ideaProject.findUniqueOrThrow({ where: { id } }), beforeRow); assert.equal(await db.ideaProject.count({ where: { ownerId: owner.id } }), 1);
  for (const caller of [owner, member, secondMember]) { assert.ok(!logs.join('\n').includes(caller.token)); assert.ok(!logs.join('\n').includes(caller.subject)); }
  for (const header of credentials) if (header) assert.ok(!logs.join('\n').includes(header)); assert.doesNotMatch(logs.join('\n'), /PRIVATE_IDEA_SENTINEL/);
});
