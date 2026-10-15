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
import { parseIdea } from '../src/ideas/idea.input';
const db = new DatabaseService();
const config = readAuthConfig({ SUPABASE_URL: 'https://ideas-test.example.invalid' })!;
let app: INestApplication; let verifier: SupabaseTokenVerifier;
let keys: Awaited<ReturnType<typeof generateKeyPair>>; let wrong: Awaited<ReturnType<typeof generateKeyPair>>;
let subjects: string[] = []; let owner: Actor; let member: Actor;
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
beforeEach(async () => { subjects = []; owner = await actor(); member = await actor(); });
afterEach(async () => {
  await db.ideaProject.deleteMany({ where: { owner: { providerSubject: { in: subjects } } } });
  await db.applicationUser.deleteMany({ where: { providerSubject: { in: subjects } } });
});
after(async () => { await app.close(); });

test('all six idea routes require authentication and cannot create records anonymously', async () => {
  const id = randomUUID();
  await api().get(base).expect(401); await api().get(`${base}/${id}`).expect(401);
  await api().post(base).send(content).expect(401); await api().put(`${base}/${id}`).send(content).expect(401);
  await api().post(`${base}/${id}/publish`).send({}).expect(401); await api().post(`${base}/${id}/archive`).send({}).expect(401);
  assert.equal(await db.ideaProject.count({ where: { ownerId: owner.id } }), 0);
});
test('create/read/full replacement use the verified owner and private draft defaults', async () => {
  const created = await create({ ...content, title: ' Trimmed title ' });
  assert.equal(created.body.ownerId, owner.id); assert.equal(created.body.status, 'DRAFT'); assert.equal(created.body.visibility, 'PRIVATE'); assert.equal(created.body.title, 'Trimmed title');
  assert.equal(created.body.publishedAt, null); assert.equal(created.body.archivedAt, null); assert.equal(created.headers['cache-control'], 'no-store');
  assert.equal(created.body.owner, undefined); assert.equal(created.body.providerSubject, undefined);
  const read = await api().get(`${base}/${created.body.id}`).set('Authorization', `Bearer ${owner.token}`).expect(200); assert.deepEqual(read.body, created.body);
  const replaced = await api().put(`${base}/${created.body.id}`).set('Authorization', `Bearer ${owner.token}`).send({ title: 'New title' }).expect(200);
  assert.equal(replaced.body.description, ''); assert.deepEqual(replaced.body.tags, []); assert.equal(replaced.body.visibility, 'PRIVATE'); assert.equal(replaced.body.status, 'DRAFT');
});
test('identity, lifecycle and timestamp injection plus invalid content/action bodies are rejected without writes', async () => {
  for (const key of ['id', 'ownerId', 'status', 'publishedAt', 'archivedAt', 'createdAt', 'role', 'owner']) await api().post(base).set('Authorization', `Bearer ${owner.token}`).send({ ...content, [key]: member.id }).expect(400);
  for (const input of [{ title: '' }, { title: 'x'.repeat(121) }, { title: 'T', tags: ['A', ' a '] }, { title: 'T', neededSkills: null }, { title: 'T', visibility: 'PUBLIC' }]) await api().post(base).set('Authorization', `Bearer ${owner.token}`).send(input).expect(400);
  assert.equal(await db.ideaProject.count({ where: { ownerId: owner.id } }), 0);
  const created = await create(); await api().post(`${base}/${created.body.id}/publish`).set('Authorization', `Bearer ${owner.token}`).send({ visibility: 'MEMBERS' }).expect(400);
  assert.equal((await db.ideaProject.findUniqueOrThrow({ where: { id: created.body.id } })).status, 'DRAFT');
});
test('HTTP read matrix permits members only for published/shared records and returns minimal projection', async () => {
  for (const visibility of ['PRIVATE', 'MEMBERS']) for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED']) {
    const created = await create({ ...content, visibility }); const id = String(created.body.id);
    if (status !== 'DRAFT') await action(id, 'publish'); if (status === 'ARCHIVED') await action(id, 'archive');
    const visible = status === 'PUBLISHED' && visibility === 'MEMBERS';
    const read = await api().get(`${base}/${id}`).set('Authorization', `Bearer ${member.token}`).expect(visible ? 200 : 404);
    await api().get(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).expect(200);
    if (visible) {
      assert.equal(read.body.description, content.description); assert.equal(read.headers['cache-control'], 'no-store');
      assert.deepEqual(Object.keys(read.body).sort(), ['id', 'ownerId', 'title', 'summary', 'description', 'neededSkills', 'tags', 'createdAt', 'updatedAt', 'publishedAt'].sort());
    } else {
      const absent = await api().get(`${base}/${randomUUID()}`).set('Authorization', `Bearer ${member.token}`).expect(404); assert.deepEqual(read.body, absent.body);
      assert.doesNotMatch(JSON.stringify(read.body), /PRIVATE_IDEA_SENTINEL|providerSubject|deletionRequestedAt/);
    }
  }
});
test('publication does not share implicitly; published editing/unsharing works and archives are terminal/read-only', async () => {
  const created = await create(); const id = String(created.body.id); const published = await action(id, 'publish');
  assert.equal(published.body.visibility, 'PRIVATE'); assert.ok(published.body.publishedAt);
  await api().get(`${base}/${id}`).set('Authorization', `Bearer ${member.token}`).expect(404);
  await api().put(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).send({ ...content, visibility: 'MEMBERS' }).expect(200);
  await api().get(`${base}/${id}`).set('Authorization', `Bearer ${member.token}`).expect(200);
  const changed = await api().put(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).send({ title: 'Edited publication' }).expect(200);
  assert.equal(changed.body.publishedAt, published.body.publishedAt); assert.equal(changed.body.visibility, 'PRIVATE');
  await api().get(`${base}/${id}`).set('Authorization', `Bearer ${member.token}`).expect(404);
  const archived = await action(id, 'archive'); assert.equal(archived.body.publishedAt, published.body.publishedAt); assert.ok(archived.body.archivedAt);
  await action(id, 'publish', 409); await action(id, 'archive', 409);
  await api().put(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).send(content).expect(409);
  await api().delete(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).expect(404);
  await api().post(`${base}/${id}/restore`).set('Authorization', `Bearer ${owner.token}`).send({}).expect(404);
  const draft = await create(); const archivedDraft = await action(String(draft.body.id), 'archive'); assert.equal(archivedDraft.body.publishedAt, null);
});
test('other users cannot edit or transition even readable records, and lists are owner-only', async () => {
  const own = await create({ ...content, visibility: 'MEMBERS' }); const id = String(own.body.id); await action(id, 'publish');
  await create({ title: 'Member owns this' }, member);
  const spoof = await token(member.subject, { user_metadata: { ownerId: owner.id, role: 'owner', status: 'ACTIVE' } });
  await api().put(`${base}/${id}`).set('Authorization', `Bearer ${spoof}`).send(content).expect(404);
  await action(id, 'publish', 404, member); await action(id, 'archive', 404, member);
  const list = await api().get(base).set('Authorization', `Bearer ${member.token}`).expect(200);
  assert.equal(list.body.items.length, 1); assert.equal(list.body.items[0].ownerId, member.id); assert.equal(list.body.nextCursor, null);
  await api().get(base).query({ ownerId: owner.id }).set('Authorization', `Bearer ${member.token}`).expect(400);
  assert.equal((await db.ideaProject.findUniqueOrThrow({ where: { id } })).title, content.title);
});
test('suspended/held callers are denied and restricted owners are hidden without reactivation or mutation', async () => {
  const created = await create({ ...content, visibility: 'MEMBERS' }); const id = String(created.body.id); await action(id, 'publish');
  for (const restricted of ['SUSPENDED', 'HOLD']) {
    await db.applicationUser.update({ where: { id: owner.id }, data: { status: restricted === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE', deletionRequestedAt: restricted === 'HOLD' ? new Date() : null } });
    await api().get(base).set('Authorization', `Bearer ${owner.token}`).expect(403);
    await api().get(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).expect(403);
    await api().post(base).set('Authorization', `Bearer ${owner.token}`).send(content).expect(403);
    await api().put(`${base}/${id}`).set('Authorization', `Bearer ${owner.token}`).send(content).expect(403);
    await action(id, 'publish', 403); await action(id, 'archive', 403);
    const hidden = await api().get(`${base}/${id}`).set('Authorization', `Bearer ${member.token}`).expect(404); assert.doesNotMatch(JSON.stringify(hidden.body), /PRIVATE_IDEA_SENTINEL/);
    assert.equal((await db.ideaProject.findUniqueOrThrow({ where: { id } })).status, 'PUBLISHED');
  }
});
test('repository rechecks account state when the authenticated identity becomes stale before its transaction', async () => {
  const created = await create(); const id = String(created.body.id); const repo = new PrismaIdeaRepository(db);
  await db.applicationUser.update({ where: { id: owner.id }, data: { deletionRequestedAt: new Date() } });
  const input = parseIdea(content);
  for (const run of [() => repo.create(owner.id, input), () => repo.read(owner.id, id), () => repo.list(owner.id, { limit: 20 }), () => repo.replace(owner.id, id, input), () => repo.transition(owner.id, id, 'PUBLISHED')]) await assert.rejects(run, error => (error as { getStatus(): number }).getStatus() === 403);
  assert.equal((await db.ideaProject.findUniqueOrThrow({ where: { id } })).status, 'DRAFT');
});
test('expired/wrong signature/issuer/audience tokens fail without leaking tokens or private content', async () => {
  const created = await create(); const id = String(created.body.id);
  const tokens = [await token(owner.subject, { exp: Math.floor(Date.now() / 1000) - 1 }), await token(owner.subject, {}, wrong.privateKey), await token(owner.subject, { iss: 'https://wrong.example.invalid/auth/v1' }), await token(owner.subject, { aud: 'other' })];
  for (const bearer of tokens) {
    const response = await api().get(`${base}/${id}`).set('Authorization', `Bearer ${bearer}`).expect(401);
    await api().post(base).set('Authorization', `Bearer ${bearer}`).send(content).expect(401);
    assert.doesNotMatch(JSON.stringify(response.body), /PRIVATE_IDEA_SENTINEL/); assert.equal(logs.join('\n').includes(bearer), false);
  }
  assert.doesNotMatch(logs.join('\n'), /PRIVATE_IDEA_SENTINEL/);
});
test('concurrent publication applies once and returns conflicts instead of corrupting lifecycle history', async () => {
  const created = await create(); const id = String(created.body.id);
  const responses = await Promise.all(Array.from({ length: 8 }, () => api().post(`${base}/${id}/publish`).set('Authorization', `Bearer ${owner.token}`).send({})));
  assert.equal(responses.filter(response => response.status === 200).length, 1); assert.equal(responses.filter(response => response.status === 409).length, 7);
  const saved = await db.ideaProject.findUniqueOrThrow({ where: { id } }); assert.equal(saved.status, 'PUBLISHED'); assert.equal(saved.visibility, 'PRIVATE'); assert.ok(saved.publishedAt); assert.equal(saved.archivedAt, null);
});
test('archive races serialize with publication and content edits, preserving terminal archive state', async () => {
  const draft = await create(); const id = String(draft.body.id);
  const [archive, publish] = await Promise.all([
    api().post(`${base}/${id}/archive`).set('Authorization', `Bearer ${owner.token}`).send({}),
    api().post(`${base}/${id}/publish`).set('Authorization', `Bearer ${owner.token}`).send({}),
  ]);
  assert.equal(archive.status, 200); assert.ok([200, 409].includes(publish.status));
  const saved = await db.ideaProject.findUniqueOrThrow({ where: { id } }); assert.equal(saved.status, 'ARCHIVED'); assert.ok(saved.archivedAt);
  assert.equal(saved.publishedAt !== null, publish.status === 200);
  const second = await create({ title: 'Before' }); const secondId = String(second.body.id);
  const [edit, close] = await Promise.all([
    api().put(`${base}/${secondId}`).set('Authorization', `Bearer ${owner.token}`).send({ title: 'After' }),
    api().post(`${base}/${secondId}/archive`).set('Authorization', `Bearer ${owner.token}`).send({}),
  ]);
  assert.equal(close.status, 200); assert.ok([200, 409].includes(edit.status));
  const final = await db.ideaProject.findUniqueOrThrow({ where: { id: secondId } }); assert.equal(final.status, 'ARCHIVED'); assert.equal(final.title, edit.status === 200 ? 'After' : 'Before');
});
test('bounded keyset pages isolate owners, filter state and reject malformed/cross-scope cursors', async () => {
  const ids: string[] = [];
  for (let i = 0; i < 5; i++) { const created = await create({ title: `Fixture ${i}` }); ids.push(String(created.body.id)); }
  await create({ title: 'Other owner' }, member);
  let cursor: string | undefined; let firstCursor = ''; const seen: string[] = [];
  do {
    const page = await api().get(base).query({ limit: '2', ...(cursor ? { cursor } : {}) }).set('Authorization', `Bearer ${owner.token}`).expect(200);
    assert.ok(page.body.items.length <= 2); for (const row of page.body.items) { assert.equal(row.ownerId, owner.id); seen.push(String(row.id)); }
    cursor = page.body.nextCursor ?? undefined; if (!firstCursor && cursor) firstCursor = cursor;
  } while (cursor);
  assert.equal(new Set(seen).size, 5); assert.deepEqual(new Set(seen), new Set(ids));
  await action(ids[0], 'publish');
  const filtered = await api().get(base).query({ status: 'PUBLISHED' }).set('Authorization', `Bearer ${owner.token}`).expect(200); assert.equal(filtered.body.items.length, 1);
  await api().get(base).query({ cursor: firstCursor }).set('Authorization', `Bearer ${member.token}`).expect(400);
  for (const query of [{ limit: '51' }, { cursor: 'bad!' }, { status: 'PUBLISHED', cursor: firstCursor }, { status: 'UNKNOWN' }]) await api().get(base).query(query).set('Authorization', `Bearer ${owner.token}`).expect(400);
  await api().get(`${base}/not-a-uuid`).set('Authorization', `Bearer ${owner.token}`).expect(400);
});

test('competing database writer cannot archive then be overwritten by an in-flight publication', async () => {
  const created = await create(); const id = String(created.body.id);
  let unlock!: () => void; let locked!: () => void;
  const release = new Promise<void>(resolve => { unlock = resolve; });
  const acquired = new Promise<void>(resolve => { locked = resolve; });
  const competing = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "IdeaProject" WHERE id = ${id}::uuid FOR UPDATE`;
    await tx.ideaProject.update({ where: { id }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
    locked(); await release;
  }, { timeout: 10_000 });
  await acquired;
  const pending = api().post(`${base}/${id}/publish`).set('Authorization', `Bearer ${owner.token}`).send({}).then(response => response);
  try {
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      const rows = await db.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE usename = current_user AND wait_event_type = 'Lock' AND query LIKE '%IdeaProject%' AND pid <> pg_backend_pid()) AS waiting`;
      if (rows[0].waiting) { waiting = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(waiting, true, 'publication must overlap the competing locked write');
  } finally { unlock(); await competing; }
  const result = await pending; assert.equal(result.status, 409);
  const saved = await db.ideaProject.findUniqueOrThrow({ where: { id } }); assert.equal(saved.status, 'ARCHIVED'); assert.equal(saved.publishedAt, null); assert.ok(saved.archivedAt);
});
