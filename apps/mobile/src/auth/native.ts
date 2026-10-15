import 'react-native-url-polyfill/auto';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createSupabaseProvider, sendDevelopmentOtp, verifyDevelopmentOtp } from './provider';
import { validateConfig } from './config';
import { ChunkedSecureStorage } from './secure-storage';
import { OAuthCoordinator } from './oauth';
import { AccessFailure, type CurrentUser, SessionManager } from './session';
import { createIdeaRequest } from '../ideas/transport';
import { createProfileRequest } from '../profiles/transport';

// Supabase otherwise permits a plain PKCE fallback when native WebCrypto is absent.
// Supply CSPRNG and SHA-256 via Expo's platform crypto, then enforce S256 in oauth.ts.
if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: Crypto.getRandomValues, randomUUID: Crypto.randomUUID }, configurable: true });
if (!globalThis.crypto.subtle) Object.defineProperty(globalThis.crypto, 'subtle', { value: {
  digest: (algorithm: string, data: BufferSource) => {
    if (algorithm !== 'SHA-256') throw new Error('Unsupported digest');
    return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
  },
} });

const storage = new ChunkedSecureStorage({
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  removeItem: key => SecureStore.deleteItemAsync(key),
}, Crypto.randomUUID);

export function createAuthentication() {
  const config = validateConfig({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    redirectUri: process.env.EXPO_PUBLIC_AUTH_REDIRECT_URI,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    emailOtpEnabled: process.env.EXPO_PUBLIC_ENABLE_EMAIL_OTP,
  });
  if (!config) return null;
  const safeFetch: typeof fetch = async (input, init) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (init?.signal?.aborted) controller.abort();
    init?.signal?.addEventListener('abort', abort);
    const timeout = setTimeout(abort, 10_000);
    try { return await fetch(input, { ...init, signal: controller.signal }); }
    finally { clearTimeout(timeout); init?.signal?.removeEventListener('abort', abort); }
  };
  const client = createSupabaseProvider(config, storage, safeFetch);
  const session = new SessionManager({
    restore: async () => {
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error('Session unavailable');
      return data.session;
    },
    subscribe: listener => {
      const { data } = client.auth.onAuthStateChange((_event, value) => listener(value));
      return () => data.subscription.unsubscribe();
    },
    refresh: active => { if (active) void client.auth.startAutoRefresh(); else void client.auth.stopAutoRefresh(); },
    signOut: async () => {
      const { error } = await client.auth.signOut({ scope: 'local' });
      // This SDK clears local storage even on revocation network failure. Verify it.
      if (await storage.getItem('entrcollab.auth') !== null) throw new Error('Secure storage unavailable');
      return { remoteRevoked: !error };
    },
  }, async token => {
    const response = await safeFetch(`${config.apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new AccessFailure(response.status);
    const body = await response.json() as CurrentUser;
    if (typeof body.id !== 'string' || body.status !== 'ACTIVE') throw new Error('Invalid account response');
    return body;
  });
  const oauth = new OAuthCoordinator({
    begin: async redirectTo => {
      const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
      if (error || !data.url || !data.flowId) throw new Error('Unable to begin sign-in');
      return { url: data.url, flowId: data.flowId };
    },
    open: (url, redirectUri) => WebBrowser.openAuthSessionAsync(url, redirectUri),
    exchange: async (code, flowId) => {
      const { error } = await client.auth.exchangeCodeForSession(code, { flowId });
      if (error) throw new Error('Unable to complete sign-in');
    },
  }, config.supabaseUrl, config.redirectUri, Crypto.randomUUID);
  const access = async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error('Session unavailable');
    return data.session;
  };
  const profileRequest = createProfileRequest(config.apiUrl, () => session.snapshot, access, safeFetch);
  const ideaRequest = createIdeaRequest(config.apiUrl, () => session.snapshot, access, safeFetch);
  return {
    profileRequest, ideaRequest,
    session, emailOtpEnabled: config.emailOtpEnabled,
    google: async () => { const result = await oauth.signIn(); if (result === 'complete') await session.restore(); return result; },
    sendOtp: (email: string) => sendDevelopmentOtp(client, config.emailOtpEnabled, email),
    verifyOtp: async (email: string, token: string) => {
      await verifyDevelopmentOtp(client, config.emailOtpEnabled, email, token);
      await session.restore();
    },
  };
}
