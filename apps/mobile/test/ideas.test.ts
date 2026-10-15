import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { IdeaClient, IdeaFailure, type IdeaRequest } from '../src/ideas/client';
import { IdeaController } from '../src/ideas/controller';
import { audience, emptyDraft, validate, type Idea } from '../src/ideas/model';
import { createIdeaRequest } from '../src/ideas/transport';
import type { AuthState } from '../src/auth/session';
const owner = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000002';
const date = '2026-10-15T12:00:00.000Z';
const idea = (patch: Partial<Idea> = {}): Idea => ({ ...emptyDraft(), title: 'Build together', id, ownerId: owner, status: 'DRAFT', createdAt: date, updatedAt: date, publishedAt: null, archivedAt: null, ...patch });
function harness() {
  const calls: Parameters<IdeaRequest>[] = []; let denied = 0;
  let handle: IdeaRequest = async (method, route, input) => Response.json(method === 'GET' && !route.id ? { items: [], nextCursor: null } : idea(input));
  const client = new IdeaClient(async (...args) => { calls.push(args); return handle(...args); });
  const controller = new IdeaController(client, owner, () => { denied++; });
  return { controller, calls, client, set: (next: IdeaRequest) => { handle = next; }, denied: () => denied };
}
test('private defaults, trimmed complete inputs and Unicode limits match API', () => {
  assert.equal(emptyDraft().visibility, 'PRIVATE');
  assert.equal(validate({ ...emptyDraft(), title: '  idea  ' }).input.title, 'idea');
  assert.deepEqual(validate({ ...emptyDraft(), title: '🌱'.repeat(120) }).errors, {});
  for (const draft of [{ title: '' }, { title: '🌱'.repeat(121) }, { title: '\ud800' }, { title: 'a\u0000b' }, { summary: 'x'.repeat(281) }, { description: 'x'.repeat(5001) }, { tags: ['AI', 'ＡＩ'] }, { neededSkills: [''] }, { tags: ['x'.repeat(51)] }, { tags: Array.from({ length: 21 }, (_, i) => String(i)) }]) assert.ok(Object.keys(validate({ ...emptyDraft(), title: 'Idea', ...draft }).errors).length);
  assert.deepEqual(validate({ ...emptyDraft(), title: 'Idea', description: 'line\nnext\ttab', tags: ['🌱'] }).errors, {});
});
test('audience follows effective status, never the stored preference alone', () => {
  for (const status of ['DRAFT', 'ARCHIVED'] as const) assert.equal(audience(idea({ status, visibility: 'MEMBERS' })), 'Only you');
  assert.equal(audience(idea({ status: 'PUBLISHED', visibility: 'MEMBERS' })), 'Signed-in members');
});
test('create sends full private input once and opens saved detail without publishing', async () => {
  const h = harness(); h.controller.newDraft(); h.controller.change('title', '  Idea  '); await h.controller.requestSave();
  assert.equal(h.controller.snapshot.screen, 'detail'); assert.equal(h.controller.snapshot.dirty, false);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], 'POST'); assert.deepEqual(h.calls[0][1], {});
  assert.equal(h.calls[0][2]?.visibility, 'PRIVATE'); assert.equal(h.calls[0][2]?.title, 'Idea');
});
test('invalid form never sends a request', async () => {
  const h = harness(); h.controller.newDraft(); await h.controller.requestSave(); assert.ok(h.controller.snapshot.errors.title); assert.equal(h.calls.length, 0);
});
test('owner DTO is allowlisted and rejects other owners, IDs and malformed/member projections', async () => {
  for (const bad of [idea({ ownerId: 'another' }), idea({ id: 'not-uuid' }), { ...idea(), status: undefined }, idea({ tags: [42] as unknown as string[] }), idea({ publishedAt: date }), idea({ status: 'PUBLISHED' }), idea({ status: 'ARCHIVED' }), idea({ title: '' })]) {
    const h = harness(); h.set(async () => Response.json(bad)); await assert.rejects(h.client.read(owner, id), (e: unknown) => e instanceof IdeaFailure && e.kind === 'unavailable');
  }
  const h = harness(); h.set(async () => Response.json({ ...idea(), providerSubject: 'private', access_token: 'sensitive', account: {} }));
  const value = await h.client.read(owner, id); assert.deepEqual(Object.keys(value).sort(), Object.keys(idea()).sort());
  h.set(async () => Response.json(idea({ id: owner }))); await assert.rejects(h.client.read(owner, id));
});
test('published members edits require explicit confirmation; cancel and double confirm are safe', async () => {
  const h = harness(); const published = idea({ status: 'PUBLISHED', publishedAt: date, visibility: 'MEMBERS', tags: ['preserve'], description: 'keep' });
  h.set(async () => Response.json(published)); await h.controller.open(id); h.controller.edit(); h.controller.change('title', 'Updated');
  await h.controller.requestSave(); assert.equal(h.calls.length, 1); assert.equal(h.controller.snapshot.confirmation, 'share');
  h.controller.change('title', 'blocked'); assert.equal(h.controller.snapshot.draft.title, 'Updated');
  h.controller.cancelConfirmation(); assert.equal(h.calls.length, 1); await h.controller.requestSave();
  await Promise.all([h.controller.confirm(), h.controller.confirm()]); assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1][0], 'PUT'); assert.deepEqual(h.calls[1][2]?.tags, ['preserve']); assert.equal(h.calls[1][2]?.visibility, 'MEMBERS');
});
test('withdrawing sharing saves privately without an extra sharing confirmation', async () => {
  const h = harness(); h.set(async () => Response.json(idea({ status: 'PUBLISHED', publishedAt: date, visibility: 'MEMBERS' })));
  await h.controller.open(id); h.controller.edit(); h.controller.change('visibility', 'PRIVATE'); await h.controller.requestSave();
  assert.equal(h.calls[1][2]?.visibility, 'PRIVATE'); assert.equal(h.controller.snapshot.confirmation, null);
});
test('publish and archive each require confirmation and preserve server state', async () => {
  const h = harness(); await h.controller.open(id); h.controller.requestAction('publish'); assert.equal(h.calls.length, 1);
  h.controller.cancelConfirmation(); assert.equal(h.calls.length, 1); h.controller.requestAction('publish');
  h.set(async () => Response.json(idea({ status: 'PUBLISHED', publishedAt: date })));
  await Promise.all([h.controller.confirm(), h.controller.confirm()]); assert.equal(h.calls.length, 2); assert.equal(h.controller.snapshot.idea?.visibility, 'PRIVATE');
  h.controller.requestAction('archive'); assert.equal(h.calls.length, 2);
  h.set(async () => Response.json(idea({ status: 'ARCHIVED', publishedAt: date, archivedAt: date })));
  await h.controller.confirm(); assert.equal(h.controller.snapshot.idea?.status, 'ARCHIVED');
  h.controller.edit(); h.controller.requestAction('publish'); h.controller.requestAction('archive'); await h.controller.confirm();
  assert.equal(h.calls.length, 3); assert.equal(h.controller.snapshot.screen, 'detail');
});
test('ambiguous creation keeps local draft and prevents repeated POST until explicit review/resume', async () => {
  const h = harness(); h.controller.newDraft(); h.controller.change('title', 'Keep this draft');
  h.set(async () => { throw new Error('private network detail'); }); await h.controller.requestSave();
  assert.equal(h.controller.snapshot.uncertainCreate, true); assert.equal(h.controller.snapshot.draft.title, 'Keep this draft');
  await h.controller.requestSave(); h.controller.newDraft(); assert.equal(h.calls.length, 1);
  h.set(async () => Response.json({ items: [idea()], nextCursor: null })); await h.controller.list('ALL');
  assert.equal(h.controller.snapshot.uncertainCreate, true); assert.equal(h.controller.snapshot.draft.title, 'Keep this draft');
  h.controller.resumeDraft(); assert.equal(h.controller.snapshot.screen, 'form'); assert.equal(h.controller.snapshot.uncertainCreate, false);
  h.set(async () => Response.json(idea())); await h.controller.requestSave(); assert.equal(h.calls.length, 3);
  assert.ok(!JSON.stringify(h.controller.snapshot).includes('private network detail'));
});
test('malformed successful creation and server failure are treated as ambiguous, not blindly retried', async () => {
  for (const response of [Response.json({}, { status: 201 }), Response.json({ error: 'private details' }, { status: 503 })]) {
    const h = harness(); h.set(async () => response); h.controller.newDraft(); h.controller.change('title', 'Idea'); await h.controller.requestSave();
    assert.equal(h.controller.snapshot.uncertainCreate, true); await h.controller.requestSave(); assert.equal(h.calls.length, 1);
  }
});
test('400 save keeps editable draft; ambiguous update and conflict require reload', async () => {
  for (const code of [400, 409, 404, 503]) {
    const h = harness(); await h.controller.open(id); h.controller.edit(); h.controller.change('title', 'Unsaved');
    h.set(async () => Response.json({ secret: 'never display' }, { status: code })); await h.controller.requestSave();
    assert.equal(h.controller.snapshot.draft.title, 'Unsaved'); assert.equal(h.controller.snapshot.needsReload, code !== 400);
    assert.ok(!JSON.stringify(h.controller.snapshot).includes('never display'));
    if (code !== 400) { await h.controller.requestSave(); assert.equal(h.calls.length, 2); }
  }
});
test('ambiguous publish and conflict disable actions until a fresh server read', async () => {
  for (const code of [409, 503]) {
    const h = harness(); await h.controller.open(id); h.set(async () => new Response(null, { status: code }));
    h.controller.requestAction('publish'); await h.controller.confirm(); assert.equal(h.controller.snapshot.needsReload, true);
    h.controller.requestAction('archive'); h.controller.edit(); await h.controller.confirm(); assert.equal(h.calls.length, 2);
    h.set(async () => Response.json(idea({ status: 'PUBLISHED', publishedAt: date }))); await h.controller.open(id);
    assert.equal(h.controller.snapshot.needsReload, false); assert.equal(h.controller.snapshot.idea?.status, 'PUBLISHED');
  }
});
test('pagination is owner-only, de-duplicated, retryable and filters can return to All', async () => {
  const h = harness(); h.set(async () => Response.json({ items: [idea()], nextCursor: 'abc' })); await h.controller.list('DRAFT');
  h.set(async () => { throw new Error('offline'); }); await h.controller.list('DRAFT', true);
  assert.equal(h.controller.snapshot.items.length, 1); assert.equal(h.controller.snapshot.cursor, 'abc');
  h.set(async () => Response.json({ items: [idea({ title: 'updated' }), idea({ id: owner })], nextCursor: null })); await h.controller.list('DRAFT', true);
  assert.equal(h.controller.snapshot.items.length, 2); assert.equal(h.controller.snapshot.items[0].title, 'updated');
  h.set(async () => Response.json({ items: [], nextCursor: null })); await h.controller.list('ALL');
  assert.equal(h.controller.snapshot.filter, undefined); assert.equal(h.calls.at(-1)?.[1].query?.status, undefined);
});
test('invalid and stalled pages fail closed', async () => {
  for (const page of [{ items: [idea(), idea()], nextCursor: null }, { items: [], nextCursor: 'https://evil' }, { items: [idea({ ownerId: 'other' })], nextCursor: null }, { items: [idea({ status: 'ARCHIVED', archivedAt: date })], nextCursor: null }]) {
    const h = harness(); h.set(async () => Response.json(page)); await assert.rejects(h.client.list(owner, 'DRAFT'));
  }
  const h = harness(); h.set(async () => Response.json({ items: [], nextCursor: 'abc' })); await assert.rejects(h.client.list(owner, undefined, 'abc'));
});
test('authentication failures clear private state and report access denial exactly once', async () => {
  for (const code of [401, 403]) {
    const h = harness(); await h.controller.open(id); h.controller.edit(); h.controller.change('title', 'private draft');
    h.set(async () => new Response(null, { status: code })); await h.controller.requestSave();
    assert.equal(h.denied(), 1); assert.equal(h.controller.snapshot.idea, null); assert.equal(h.controller.snapshot.draft.title, '');
    await h.controller.list(); assert.equal(h.denied(), 1);
  }
});
test('stopped controllers cannot restore private responses or mutate after unmount/account change', async () => {
  const h = harness(); let resolve!: (response: Response) => void;
  h.set(() => new Promise(done => { resolve = done; })); const pending = h.controller.open(id); h.controller.stop(); resolve(Response.json(idea())); await pending;
  assert.equal(h.controller.snapshot.idea, null); h.controller.newDraft(); await h.controller.requestSave(); assert.equal(h.calls.length, 1);
});
test('detail read failures remove old content and keep retry target', async () => {
  const h = harness(); await h.controller.open(id); h.set(async () => new Response(null, { status: 404 })); await h.controller.open(id);
  assert.equal(h.controller.snapshot.idea, null); assert.equal(h.controller.snapshot.targetId, id); assert.equal(h.controller.snapshot.retry, 'detail');
});
const signedIn: AuthState = { phase: 'signedIn', user: { id: owner, status: 'ACTIVE', createdAt: date, updatedAt: date } };
test('transport fixes destination/routes and sends only current bearer and allowlisted body', async () => {
  const seen: [RequestInfo | URL, RequestInit | undefined][] = [];
  const request = createIdeaRequest('https://development.invalid/api/v1', () => signedIn, async () => ({ access_token: 'mock-token', expires_at: Date.now() / 1000 + 600 }), async (url, init) => { seen.push([url, init]); return Response.json(idea()); });
  await request('GET', { query: { status: 'DRAFT', cursor: 'abc' } }); await request('POST', { id, action: 'publish' }); await request('PUT', { id }, { ...emptyDraft(), title: 'Idea' });
  assert.equal(seen[0][0], 'https://development.invalid/api/v1/ideas?status=DRAFT&cursor=abc'); assert.equal(seen[1][1]?.body, '{}');
  assert.equal((seen[2][1]?.headers as Record<string, string>).Authorization, 'Bearer mock-token');
  assert.equal(JSON.parse(seen[2][1]?.body as string).visibility, 'PRIVATE');
  await assert.rejects(request('GET', { id: 'https://evil.invalid' })); await assert.rejects(request('PUT', {})); await assert.rejects(request('POST', { id }));
  assert.equal(seen.length, 3);
});
test('transport rejects missing/expired session and account switches during token lookup without fetching', async () => {
  let fetched = 0; let current = signedIn;
  for (const mode of ['missing', 'expired', 'switch', 'signedOut'] as const) {
    current = mode === 'signedOut' ? { phase: 'signedOut' } : signedIn;
    const request = createIdeaRequest('https://development.invalid/api/v1', () => current, async () => {
      if (mode === 'switch') current = { ...signedIn, user: { ...signedIn.user!, id } };
      return mode === 'missing' ? null : { access_token: 'private', expires_at: Date.now() / 1000 + (mode === 'expired' ? -1 : 600) };
    }, async () => { fetched++; return new Response(); });
    assert.equal((await request('GET', {})).status, 401);
  }
  assert.equal(fetched, 0);
});

test('native URLSearchParams polyfill preserves status/cursor pagination queries', async () => {
  const native = createRequire(import.meta.url)('whatwg-url-without-unicode').URLSearchParams as typeof URLSearchParams;
  const previous = globalThis.URLSearchParams; globalThis.URLSearchParams = native;
  try {
    let destination = '';
    const request = createIdeaRequest('https://development.invalid/api/v1', () => signedIn, async () => ({ access_token: 'mock', expires_at: Date.now() / 1000 + 60 }), async input => { destination = String(input); return new Response(); });
    await request('GET', { query: { status: 'ARCHIVED', cursor: 'abc' } });
    assert.equal(destination, 'https://development.invalid/api/v1/ideas?status=ARCHIVED&cursor=abc');
  } finally { globalThis.URLSearchParams = previous; }
});
