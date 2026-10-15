import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OAuthCoordinator } from '../src/auth/oauth';
import { createHash } from 'node:crypto';
import { createSupabaseProvider, sendDevelopmentOtp, verifyDevelopmentOtp } from '../src/auth/provider';
import type { MobileAuthConfig } from '../src/auth/config';
import type { SecureDriver } from '../src/auth/secure-storage';

const config: MobileAuthConfig = {
  supabaseUrl: 'https://provider.example.invalid', publishableKey: 'sb_publishable_test',
  redirectUri: 'test-only://callback', apiUrl: 'https://api.example.invalid/api/v1', emailOtpEnabled: false,
};
const subject = 'aa111111-1111-4111-8111-111111111111';
const expires = Math.floor(Date.now() / 1000) + 3600;
const accessToken = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: subject, exp: expires })).toString('base64url')}.test-signature`;
const response = { access_token: accessToken, refresh_token: 'test-refresh-token', expires_in: 3600, token_type: 'bearer', user: { id: subject, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: {}, created_at: new Date(0).toISOString() } };
function memoryStorage() {
  const map = new Map<string, string>();
  const storage: SecureDriver = { getItem: async k => map.get(k) ?? null, setItem: async (k, v) => { map.set(k, v); }, removeItem: async k => { map.delete(k); } };
  return { map, storage };
}
test('real Supabase SDK uses S256, stored verifier, flow-bound exchange and restart/logout', async () => {
  const { map, storage } = memoryStorage();
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url, body });
    return new Response(url.includes('/logout') ? '{}' : JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const client = createSupabaseProvider(config, storage, fetcher);
  const begun = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${config.redirectUri}?auth_attempt=test-state`, skipBrowserRedirect: true } });
  assert.equal(begun.error, null); assert.ok(begun.data.flowId);
  const authUrl = new URL(begun.data.url!);
  assert.equal(authUrl.searchParams.get('code_challenge_method'), 's256');
  const saved = [...map.entries()].find(([key]) => key.includes(begun.data.flowId!) && key.endsWith('-code-verifier'));
  assert.ok(saved);
  const verifier = JSON.parse(saved[1]) as string;
  assert.equal(authUrl.searchParams.get('code_challenge'), createHash('sha256').update(verifier).digest('base64url'));
  const exchanged = await client.auth.exchangeCodeForSession('test-code', { flowId: begun.data.flowId! });
  assert.equal(exchanged.error, null); assert.equal(calls[0].body.code_verifier, verifier);
  assert.equal(calls[0].body.auth_code, 'test-code'); assert.ok(calls[0].url.includes('grant_type=pkce'));
  assert.ok(map.has('entrcollab.auth'));
  const restarted = createSupabaseProvider(config, storage, fetcher);
  assert.equal((await restarted.auth.getSession()).data.session?.user.id, subject);
  await restarted.auth.signOut({ scope: 'local' }); assert.equal(await storage.getItem('entrcollab.auth'), null);
  assert.ok(calls.some(c => c.url.includes('scope=local')));
  await client.auth.stopAutoRefresh(); await restarted.auth.stopAutoRefresh();
});
test('real SDK local signout clears storage on remote server failure', async () => {
  const { storage } = memoryStorage(); let offline = false;
  const client = createSupabaseProvider(config, storage, async () => new Response(JSON.stringify(offline ? { message: 'test provider failure' } : response), { status: offline ? 503 : 200, headers: { 'Content-Type': 'application/json' } }));
  await client.auth.verifyOtp({ email: 'tester@example.invalid', token: 'test-code', type: 'email' });
  offline = true;
  const result = await client.auth.signOut({ scope: 'local' }); assert.ok(result.error);
  assert.equal(await storage.getItem('entrcollab.auth'), null); await client.auth.stopAutoRefresh();
});
test('OTP disabled by default, sends only existing-user requests, and verifies email code', async () => {
  const { storage } = memoryStorage(); const calls: { url: string; body: Record<string, unknown> }[] = [];
  const client = createSupabaseProvider(config, storage, async (input, init) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(String(input).endsWith('/otp') ? {} : response), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  await assert.rejects(sendDevelopmentOtp(client, false, 'tester@example.invalid'));
  await assert.rejects(verifyDevelopmentOtp(client, false, 'tester@example.invalid', 'test-code')); assert.equal(calls.length, 0);
  await sendDevelopmentOtp(client, true, ' TESTER@example.invalid ');
  assert.equal(calls[0].body.create_user, false); assert.equal(calls[0].body.email, 'tester@example.invalid');
  await verifyDevelopmentOtp(client, true, 'tester@example.invalid', 'test-code');
  assert.equal(calls[1].body.type, 'email'); assert.equal(calls[1].body.token, 'test-code');
  await client.auth.signOut({ scope: 'local' }); await client.auth.stopAutoRefresh();
});

test('coordinator interoperates with actual SDK redirect defaults and code exchange', async () => {
  const { storage } = memoryStorage(); let exchanges = 0;
  const client = createSupabaseProvider(config, storage, async (input) => { if (String(input).includes('grant_type=pkce')) exchanges++; return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  const coordinator = new OAuthCoordinator({
    begin: async redirectTo => { const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } }); assert.equal(error, null); return { url: data.url!, flowId: data.flowId! }; },
    open: async url => { const redirect = new URL(new URL(url).searchParams.get('redirect_to')!); assert.equal(redirect.searchParams.has('sb_flow_id'), false); redirect.searchParams.set('code', 'test-code'); return { type: 'success', url: redirect.toString() }; },
    exchange: async (code, flowId) => { const { error } = await client.auth.exchangeCodeForSession(code, { flowId }); assert.equal(error, null); },
  }, config.supabaseUrl, config.redirectUri, () => 'test-attempt');
  assert.equal(await coordinator.signIn(), 'complete'); assert.equal(exchanges, 1);
  await client.auth.signOut({ scope: 'local' }); await client.auth.stopAutoRefresh();
});
