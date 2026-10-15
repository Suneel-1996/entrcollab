import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProfileClient, ProfileFailure } from '../src/profiles/client';
import { ProfileController } from '../src/profiles/controller';
import { createProfileRequest } from '../src/profiles/transport';
import { emptyDraft, fields, toDraft, validateDraft, type Profile, type ProfileInput } from '../src/profiles/model';
import { initialProfileGate, profileGateForAuth } from '../src/profiles/session-gate';
import type { AuthState } from '../src/auth/session';
const userId = '11111111-1111-4111-8111-111111111111';
const user = { id: userId, status: 'ACTIVE', createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
const profile: Profile = { userId, displayName: 'Builder', bio: 'Private bio', skills: ['TypeScript'], interests: ['Climate'], availability: 'Weekends', visibility: { displayName: 'MEMBERS', bio: 'PRIVATE', skills: 'PRIVATE', interests: 'MEMBERS', availability: 'PRIVATE' }, createdAt: user.createdAt, updatedAt: user.updatedAt };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function setup(initial: Profile | null = null) {
  let stored = initial; let fail: number | 'network' | null = null; let denied = 0;
  const writes: ProfileInput[] = []; const methods: string[] = [];
  const client = new ProfileClient(async (method, input) => {
    methods.push(method);
    if (fail === 'network') throw new Error('TOKEN_SENTINEL private provider error');
    if (fail) return json({ secret: 'TOKEN_SENTINEL' }, fail);
    if (method === 'GET') return stored ? json(stored) : json({}, 404);
    writes.push(input!); stored = { ...input!, userId, createdAt: user.createdAt, updatedAt: user.updatedAt }; return json(stored);
  });
  const controller = new ProfileController(client, userId, () => { denied++; });
  return { controller, writes, methods, client, setFailure: (value: typeof fail) => { fail = value; }, get denied() { return denied; } };
}

test('missing profile starts setup with every field private and no implicit write', async () => {
  const app = setup(); await app.controller.load(); const state = app.controller.snapshot;
  assert.equal(state.phase, 'edit'); assert.equal(state.profile, null); assert.equal(state.dirty, false); assert.equal(app.writes.length, 0);
  for (const field of fields) assert.equal(state.draft.visibility[field], 'PRIVATE');
});
test('onboarding validates before save, normalizes input and opens saved summary', async () => {
  const app = setup(); await app.controller.load(); await app.controller.save();
  assert.ok(app.controller.snapshot.errors.displayName); assert.equal(app.writes.length, 0);
  app.controller.change('displayName', ' New builder '); app.controller.tags('skills', [' TypeScript ']); app.controller.visibility('skills', 'MEMBERS');
  await app.controller.save(); assert.equal(app.controller.snapshot.phase, 'view'); assert.equal(app.controller.snapshot.dirty, false);
  assert.equal(app.controller.snapshot.profile?.displayName, 'New builder'); assert.equal(app.writes[0].skills[0], 'TypeScript');
  assert.equal(app.writes[0].visibility.skills, 'MEMBERS'); assert.equal(app.writes[0].visibility.displayName, 'PRIVATE');
  assert.equal(Object.hasOwn(app.writes[0], 'userId'), false);
});
test('returning user loads summary, edits all fields/settings, cancels without a write', async () => {
  const app = setup(profile); await app.controller.load(); assert.equal(app.controller.snapshot.phase, 'view'); app.controller.edit();
  assert.deepEqual(app.controller.snapshot.draft.visibility, profile.visibility);
  app.controller.change('bio', 'Changed'); app.controller.visibility('displayName', 'PRIVATE'); assert.equal(app.controller.snapshot.dirty, true);
  app.controller.cancel(); assert.equal(app.controller.snapshot.phase, 'view'); assert.equal(app.controller.snapshot.draft.bio, profile.bio);
  assert.equal(app.controller.snapshot.draft.visibility.displayName, 'MEMBERS'); assert.equal(app.writes.length, 0);
});
test('unchanged edit saves the full contract including all visibility settings and arrays', async () => {
  const app = setup(profile); await app.controller.load(); app.controller.edit(); await app.controller.save();
  assert.deepEqual(app.writes[0].visibility, profile.visibility); assert.deepEqual(app.writes[0].skills, profile.skills);
  for (const field of fields) assert.ok(Object.hasOwn(app.writes[0], field));
});
test('removing optional content and withdrawing sharing sends explicit empty/private values', async () => {
  const app = setup(profile); await app.controller.load(); app.controller.edit(); app.controller.tags('skills', []); app.controller.change('bio', '');
  app.controller.visibility('displayName', 'PRIVATE'); await app.controller.save();
  assert.deepEqual(app.writes[0].skills, []); assert.equal(app.writes[0].bio, ''); assert.equal(app.writes[0].visibility.displayName, 'PRIVATE');
});
test('blank, too-long, duplicate and unsupported-control inputs show local errors', () => {
  for (const [field, value] of [['displayName', ''], ['displayName', 'a'.repeat(81)], ['bio', 'a'.repeat(2001)], ['availability', 'a'.repeat(201)], ['bio', 'bad\u0000value']] as const) {
    const draft = { ...emptyDraft(), displayName: 'Name', [field]: value }; assert.ok(validateDraft(draft).errors[field]);
  }
  for (const values of [[''], ['A', ' a '], ['Ａ', 'a'], ['a'.repeat(51)], Array.from({ length: 21 }, (_, i) => String(i))]) {
    assert.ok(validateDraft({ ...emptyDraft(), displayName: 'Name', skills: values }).errors.skills);
  }
});
test('Unicode boundaries, optional empties and multiline tag entries match the backend contract', () => {
  const draft = { ...emptyDraft(), displayName: '🧑'.repeat(80), bio: 'x'.repeat(2000), skills: ['Node\nJS', 'tab\tentry'], availability: 'x'.repeat(200) };
  assert.deepEqual(validateDraft(draft).errors, {});
  const original = { ...profile, skills: ['Node\nJS', 'Comma, tag'] }; assert.deepEqual(validateDraft(toDraft(original)).input.skills, original.skills);
});
test('editing back to baseline clears dirty state; drafts never mutate saved data', async () => {
  const app = setup(profile); await app.controller.load(); app.controller.edit(); app.controller.tags('skills', ['Other']);
  assert.deepEqual(app.controller.snapshot.profile?.skills, profile.skills);
  app.controller.tags('skills', profile.skills); assert.equal(app.controller.snapshot.dirty, false);
});
for (const failure of ['network', 500, 503, 400] as const) test(`save failure ${failure} retains draft and permits retry`, async () => {
  const app = setup(profile); await app.controller.load(); app.controller.edit(); app.controller.change('bio', 'Unsaved bio'); app.setFailure(failure);
  await app.controller.save(); assert.equal(app.controller.snapshot.phase, 'edit'); assert.equal(app.controller.snapshot.draft.bio, 'Unsaved bio');
  assert.equal(app.controller.snapshot.dirty, true); assert.ok(app.controller.snapshot.message); assert.doesNotMatch(JSON.stringify(app.controller.snapshot), /TOKEN_SENTINEL/);
  app.setFailure(null); await app.controller.save(); assert.equal(app.controller.snapshot.phase, 'view'); assert.equal(app.controller.snapshot.profile?.bio, 'Unsaved bio');
});
test('load failure is not treated as new-user 404 and can be retried', async () => {
  const app = setup(profile); app.setFailure('network'); await app.controller.load(); assert.equal(app.controller.snapshot.phase, 'loadError');
  app.setFailure(null); await app.controller.load(); assert.equal(app.controller.snapshot.phase, 'view');
});
for (const status of [401, 403]) test(`access denial ${status} clears draft and saved data and invalidates session`, async () => {
  const app = setup(profile); await app.controller.load(); app.controller.edit(); app.controller.change('bio', 'Sensitive draft'); app.setFailure(status);
  await app.controller.save(); assert.equal(app.denied, 1); assert.equal(app.controller.snapshot.profile, null); assert.equal(app.controller.snapshot.draft.bio, '');
  assert.doesNotMatch(JSON.stringify(app.controller.snapshot), /Sensitive draft|Private bio|TOKEN_SENTINEL/);
});
test('double save and editing during a save cannot enqueue a second write', async () => {
  const response = deferred<Response>(); let writes = 0;
  const client = new ProfileClient(async method => { if (method === 'GET') return json({}, 404); writes++; return response.promise; });
  const controller = new ProfileController(client, userId, () => {}); await controller.load(); controller.change('displayName', 'First');
  const saving = controller.save(); controller.change('displayName', 'Second'); controller.tags('skills', ['Second']); await controller.save(); await controller.load();
  assert.equal(writes, 1); assert.equal(controller.snapshot.draft.displayName, 'First'); response.resolve(json({ ...profile, displayName: 'First' })); await saving; assert.equal(controller.snapshot.phase, 'view');
});
test('stopping the screen clears private state and ignores late saves or access failures', async () => {
  for (const status of [200, 401]) {
    const pending = deferred<Response>(); let denied = 0;
    const controller = new ProfileController(new ProfileClient(async method => method === 'GET' ? json(profile) : pending.promise), userId, () => { denied++; });
    await controller.load(); controller.edit(); controller.change('bio', 'Sensitive draft'); const save = controller.save(); controller.stop();
    pending.resolve(json(profile, status)); await save;
    assert.equal(controller.snapshot.profile, null); assert.equal(controller.snapshot.draft.bio, ''); assert.equal(denied, 0);
  }
});
test('a late older load cannot overwrite a newer response', async () => {
  const first = deferred<Response>(); let calls = 0;
  const controller = new ProfileController(new ProfileClient(async () => ++calls === 1 ? first.promise : json(profile)), userId, () => {});
  const old = controller.load(); await controller.load(); first.resolve(json({}, 404)); await old; assert.equal(controller.snapshot.phase, 'view');
});
test('client rejects other-user/malformed responses and strips unknown server columns', async () => {
  for (const body of [{ ...profile, userId: 'other' }, { ...profile, skills: 'wrong' }, { ...profile, visibility: {} }, { ...profile, updatedAt: 'bad date' }]) {
    const client = new ProfileClient(async () => json(body)); await assert.rejects(client.load(userId), (error: unknown) => error instanceof ProfileFailure && error.kind === 'unavailable');
  }
  const client = new ProfileClient(async () => json({ ...profile, providerSubject: 'PRIVATE', token: 'TOKEN_SENTINEL' }));
  const result = await client.load(userId); assert.doesNotMatch(JSON.stringify(result), /providerSubject|TOKEN_SENTINEL/);
});
test('only GET 404 means a missing profile; failed PUT is not treated as success', async () => {
  const client = new ProfileClient(async () => json({}, 404)); assert.equal(await client.load(userId), null);
  await assert.rejects(client.save(userId, validateDraft(toDraft(profile)).input), ProfileFailure);
});
test('authenticated transport sends only current token and full JSON to the fixed owner endpoint', async () => {
  const calls: { url: string; init: RequestInit }[] = []; const state: AuthState = { phase: 'signedIn', user };
  const request = createProfileRequest('https://api.example.invalid/api/v1', () => state, async () => ({ access_token: 'TEST_ONLY_TOKEN', expires_at: Date.now() / 1000 + 60 }), async (url, init) => { calls.push({ url: String(url), init: init! }); return json(profile); });
  await request('GET'); await request('PUT', validateDraft(toDraft(profile)).input);
  assert.equal(calls[0].url, 'https://api.example.invalid/api/v1/profiles/me'); assert.equal(calls[0].init.body, undefined);
  assert.deepEqual(calls[1].init.headers, { Authorization: 'Bearer TEST_ONLY_TOKEN', 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(String(calls[1].init.body)).visibility, profile.visibility); assert.equal(JSON.parse(String(calls[1].init.body)).userId, undefined);
});
test('signed-out, expired, loading and changed-account operations never send a token or draft', async () => {
  let calls = 0; let state: AuthState = { phase: 'signedOut' }; let expired = false; let switchUser = false;
  const request = createProfileRequest('https://api.example.invalid/api/v1', () => state, async () => {
    if (switchUser) state = { phase: 'signedIn', user: { ...user, id: 'another-account' } };
    return { access_token: 'TEST_ONLY_TOKEN', expires_at: Date.now() / 1000 + (expired ? -1 : 60) };
  }, async () => { calls++; return json(profile); });
  assert.equal((await request('GET')).status, 401);
  state = { phase: 'loading' }; assert.equal((await request('PUT', profile)).status, 401);
  state = { phase: 'signedIn', user }; expired = true; assert.equal((await request('GET')).status, 401);
  expired = false; switchUser = true; assert.equal((await request('PUT', profile)).status, 401); assert.equal(calls, 0);
});

test('profile screen is hidden during revalidation, then restores only the same account screen', () => {
  const signedIn = profileGateForAuth(initialProfileGate, { phase: 'signedIn', user });
  const loading = profileGateForAuth(signedIn, { phase: 'loading' });
  assert.equal(loading.visible, false); assert.equal(loading.revision, signedIn.revision);
  const restored = profileGateForAuth(loading, { phase: 'signedIn', user });
  assert.equal(restored.visible, true); assert.equal(restored.revision, signedIn.revision);
  const other = profileGateForAuth(loading, { phase: 'signedIn', user: { ...user, id: 'another-user' } });
  assert.notEqual(other.revision, signedIn.revision); assert.equal(other.userId, 'another-user');
});
test('logout, access errors and same-account re-login never reuse an old private screen', () => {
  const previous = profileGateForAuth(initialProfileGate, { phase: 'signedIn', user });
  for (const phase of ['signedOut', 'error', 'busy'] as const) {
    const cleared = profileGateForAuth(previous, { phase }); assert.equal(cleared.userId, null); assert.equal(cleared.visible, false);
    const next = profileGateForAuth(cleared, { phase: 'signedIn', user }); assert.notEqual(next.revision, previous.revision);
  }
});
