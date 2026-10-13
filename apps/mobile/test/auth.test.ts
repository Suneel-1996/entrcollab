import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChunkedSecureStorage, type SecureDriver } from '../src/auth/secure-storage';
import { OAuthCoordinator, type OAuthPort } from '../src/auth/oauth';
import { SessionManager, AccessFailure, type Session, type SessionPort } from '../src/auth/session';
import { validateConfig } from '../src/auth/config';

const validSession = (): Session => ({ access_token: 'PRIVATE_TOKEN_SENTINEL', expires_at: Math.floor(Date.now() / 1000) + 3600 });
const user = { id: 'internal-user-id', status: 'ACTIVE', createdAt: '', updatedAt: '' };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function sessionHarness() {
  let stored: Session | null = validSession(); let listener: (s: Session | null) => void = () => undefined;
  let remoteRevoked = true; let storageFailure = false; const refresh: boolean[] = [];
  const port: SessionPort = {
    restore: async () => stored,
    subscribe: cb => { listener = cb; return () => { listener = () => undefined; }; },
    signOut: async () => { if (storageFailure) throw new Error('TOKEN_SENTINEL'); stored = null; listener(null); return { remoteRevoked }; },
    refresh: value => { refresh.push(value); },
  };
  return { port, refresh, setSession: (s: Session | null) => { stored = s; }, emit: (s: Session | null) => listener(s), setOffline: () => { remoteRevoked = false; }, failStorage: () => { storageFailure = true; } };
}
test('session restores after app restart and signout prevents restoration', async () => {
  const h = sessionHarness(); const m = new SessionManager(h.port, async () => user); await m.start();
  assert.equal(m.snapshot.phase, 'signedIn'); assert.ok(!JSON.stringify(m.snapshot).includes('PRIVATE_TOKEN_SENTINEL')); m.stop();
  const restarted = new SessionManager(h.port, async () => user); await restarted.start(); assert.equal(restarted.snapshot.phase, 'signedIn');
  await restarted.signOut(); assert.equal(restarted.snapshot.phase, 'signedOut'); assert.equal(h.refresh.at(-1), false); restarted.stop();
  const afterLogout = new SessionManager(h.port, async () => user); await afterLogout.start(); assert.equal(afterLogout.snapshot.phase, 'signedOut'); afterLogout.stop();
});
test('expired sessions and backend 401/403 clear local session', async () => {
  for (const status of [401, 403, 0]) {
    const h = sessionHarness(); if (!status) h.setSession({ ...validSession(), expires_at: 1 });
    const manager = new SessionManager(h.port, async () => { throw new AccessFailure(status); }); await manager.start();
    assert.equal(manager.snapshot.phase, 'signedOut'); assert.equal(await h.port.restore(), null); manager.stop();
  }
});
test('network failure is recoverable and does not claim authenticated access', async () => {
  const h = sessionHarness(); let fail = true;
  const manager = new SessionManager(h.port, async () => { if (fail) throw new AccessFailure(503); return user; }); await manager.start();
  assert.equal(manager.snapshot.phase, 'error'); assert.ok(await h.port.restore()); fail = false;
  await manager.restore(); assert.equal(manager.snapshot.phase, 'signedIn'); manager.stop();
});
test('offline signout clears local state and reports unconfirmed remote revocation', async () => {
  const h = sessionHarness(); h.setOffline(); const m = new SessionManager(h.port, async () => user); await m.start(); await m.signOut();
  assert.equal(m.snapshot.phase, 'signedOut'); assert.match(m.snapshot.message!, /revocation could not be confirmed/); assert.equal(await h.port.restore(), null); m.stop();
});
test('secure-storage deletion failure never claims successful logout', async () => {
  const h = sessionHarness(); const m = new SessionManager(h.port, async () => user); await m.start(); h.failStorage(); await m.signOut();
  assert.equal(m.snapshot.phase, 'error'); assert.ok(!JSON.stringify(m.snapshot).includes('TOKEN_SENTINEL')); m.stop();
});
test('late auth/me response cannot undo signout', async () => {
  const h = sessionHarness(); let resolve!: (u: typeof user) => void;
  const m = new SessionManager(h.port, () => new Promise(r => { resolve = r; })); const started = m.start(); await tick();
  await m.signOut(); resolve(user); await started; assert.equal(m.snapshot.phase, 'signedOut'); m.stop();
});
test('session changes and app foreground revalidate access; background stops refresh', async () => {
  const h = sessionHarness(); const m = new SessionManager(h.port, async () => user); await m.start(); m.foreground(false); assert.equal(h.refresh.at(-1), false);
  h.emit(null); await tick(); assert.equal(m.snapshot.phase, 'signedOut'); h.emit(validSession()); await tick(); assert.equal(m.snapshot.phase, 'signedIn');
  m.foreground(true); await tick(); assert.equal(h.refresh.at(-1), true); m.stop();
});
function oauthHarness(change?: (url: URL) => void, resultType = 'success') {
  let exchanges = 0; let opened = 0; let captured = '';
  const redirect = 'test-auth://callback'; // Test-only fixture, never a configured app redirect.
  const port: OAuthPort = {
    begin: async redirectTo => { captured = redirectTo; const url = new URL('https://auth.example.invalid/auth/v1/authorize'); url.searchParams.set('provider', 'google'); url.searchParams.set('redirect_to', redirectTo); url.searchParams.set('code_challenge_method', 's256'); url.searchParams.set('code_challenge', 'testchallenge'); return { url: url.toString(), flowId: 'test-flow-id' }; },
    open: async () => { opened++; const url = new URL(captured); url.searchParams.set('code', 'secret-test-code'); url.searchParams.set('sb_flow_id', 'test-flow-id'); change?.(url); return { type: resultType, url: url.toString() }; },
    exchange: async (code, flow) => { assert.equal(code, 'secret-test-code'); assert.equal(flow, 'test-flow-id'); exchanges++; },
  };
  return { port, coordinator: new OAuthCoordinator(port, 'https://auth.example.invalid', redirect, () => 'random-attempt'), exchanges: () => exchanges, opened: () => opened };
}
test('Google PKCE callback exchanged only after exact redirect/attempt/flow checks', async () => {
  const h = oauthHarness(); assert.equal(await h.coordinator.signIn(), 'complete'); assert.equal(h.exchanges(), 1);
});
for (const [name, mutate] of [
  ['wrong state', (u: URL) => u.searchParams.set('auth_attempt', 'different')],
  ['duplicate state', (u: URL) => u.searchParams.append('auth_attempt', 'different')],
  ['wrong flow', (u: URL) => u.searchParams.set('sb_flow_id', 'different')],
  ['wrong callback', (u: URL) => { u.host = 'attacker'; }],
  ['implicit fragment', (u: URL) => { u.hash = 'access_token=secret'; }],
  ['missing code', (u: URL) => u.searchParams.delete('code')],
  ['duplicate code', (u: URL) => u.searchParams.append('code', 'another')],
  ['provider error', (u: URL) => u.searchParams.set('error', 'access_denied')],
] as [string, (u: URL) => void][]) test(`OAuth rejects ${name}`, async () => {
  const h = oauthHarness(mutate); await assert.rejects(h.coordinator.signIn()); assert.equal(h.exchanges(), 0);
});
test('OAuth cancellation and dismissal never exchange a code', async () => {
  for (const type of ['cancel', 'dismiss']) { const h = oauthHarness(undefined, type); assert.equal(await h.coordinator.signIn(), 'cancelled'); assert.equal(h.exchanges(), 0); }
});
test('OAuth rejects plain PKCE and wrong authorization origin', async () => {
  for (const method of ['plain', 'wrong-origin']) {
    const h = oauthHarness(); const begin = h.port.begin;
    h.port.begin = async uri => { const result = await begin(uri); const url = new URL(result.url); if (method === 'plain') url.searchParams.set('code_challenge_method', 'plain'); else url.host = 'attacker.invalid'; return { ...result, url: url.toString() }; };
    await assert.rejects(h.coordinator.signIn()); assert.equal(h.opened(), 0);
  }
});
test('OAuth rejects expired attempt and replay from an earlier attempt', async () => {
  const h = oauthHarness(); let now = 0; const original = h.port.open;
  h.port.open = async (...args) => { now = 301_000; return original(...args); };
  await assert.rejects(new OAuthCoordinator(h.port, 'https://auth.example.invalid', 'test-auth://callback', () => 'nonce', () => now).signIn());
  let attempt = 0; let previous = '';
  h.port.open = async (...args) => { const result = await original(...args); if (previous) return { ...result, url: previous }; previous = result.url!; return result; };
  const m = new OAuthCoordinator(h.port, 'https://auth.example.invalid', 'test-auth://callback', () => `nonce-${++attempt}`);
  await m.signIn(); await assert.rejects(m.signIn()); assert.equal(h.exchanges(), 1);
});
test('secure storage chunks Unicode and long sessions; atomic replacement and deletion', async () => {
  const items = new Map<string, string>(); let id = 0; let fail = false;
  const driver: SecureDriver = { getItem: async k => items.get(k) ?? null, setItem: async (k, v) => { if (fail && k.endsWith('.1')) throw new Error('native failure'); assert.ok(v.length <= 1600); items.set(k, v); }, removeItem: async k => { items.delete(k); } };
  const s = new ChunkedSecureStorage(driver, () => `id-${++id}`); const value = '🔒'.repeat(1000) + 'TOKEN_SENTINEL'.repeat(400);
  await s.setItem('auth', value); assert.equal(await s.getItem('auth'), value);
  fail = true; await assert.rejects(s.setItem('auth', value + 'new')); assert.equal(await s.getItem('auth'), value);
  fail = false; await s.setItem('auth', 'short'); assert.equal(await s.getItem('auth'), 'short'); await s.removeItem('auth'); assert.equal(await s.getItem('auth'), null); assert.equal(items.size, 0);
});
test('mobile config rejects privileged key, HTTP Supabase, invented proxy redirects', () => {
  const values = { supabaseUrl: 'https://auth.example.invalid', publishableKey: 'sb_publishable_test', redirectUri: 'test-auth://callback', apiUrl: 'https://api.example.invalid/api/v1' };
  assert.ok(validateConfig(values)); assert.equal(validateConfig({}), null);
  for (const change of [{ publishableKey: 'sb_secret_do-not-use' }, { supabaseUrl: 'http://auth.example.invalid' }, { redirectUri: 'https://attacker.invalid/callback' }, { redirectUri: 'exp://localhost/callback' }, { apiUrl: 'http://external.invalid/api/v1' }]) assert.throws(() => validateConfig({ ...values, ...change }));
});

test('foreground session expiry leaves authenticated UI even without a provider event', async () => {
  const h = sessionHarness(); h.setSession({ ...validSession(), expires_at: (Date.now() + 40) / 1000 });
  const manager = new SessionManager(h.port, async () => user); await manager.start(); assert.equal(manager.snapshot.phase, 'signedIn');
  await new Promise(resolve => setTimeout(resolve, 80)); assert.equal(manager.snapshot.phase, 'signedOut'); manager.stop();
});

test('OAuth accepts a state-bound callback without optional SDK flow-id query', async () => {
  const h = oauthHarness(url => url.searchParams.delete('sb_flow_id'));
  assert.equal(await h.coordinator.signIn(), 'complete'); assert.equal(h.exchanges(), 1);
});
