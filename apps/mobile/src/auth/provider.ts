import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { MobileAuthConfig } from './config';
import type { SecureDriver } from './secure-storage';

export function createSupabaseProvider(config: MobileAuthConfig, storage: SecureDriver, fetcher: typeof fetch) {
  return createClient(config.supabaseUrl, config.publishableKey, {
    auth: { storage, storageKey: 'entrcollab.auth', flowType: 'pkce', persistSession: true, detectSessionInUrl: false, autoRefreshToken: false, debug: false },
    global: { fetch: fetcher },
  });
}
export async function sendDevelopmentOtp(client: SupabaseClient, enabled: boolean, email: string) {
  if (!enabled) throw new Error('Development OTP disabled');
  const { error } = await client.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
  if (error) throw new Error('Unable to send development code');
}
export async function verifyDevelopmentOtp(client: SupabaseClient, enabled: boolean, email: string, token: string) {
  if (!enabled) throw new Error('Development OTP disabled');
  const { data, error } = await client.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: 'email' });
  if (error) throw new Error('Unable to verify development code');
  return data.session;
}
