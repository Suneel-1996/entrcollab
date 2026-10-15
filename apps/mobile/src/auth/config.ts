export interface MobileAuthConfig {
  supabaseUrl: string; publishableKey: string; redirectUri: string; apiUrl: string; emailOtpEnabled: boolean;
}
export function validateConfig(values: {
  supabaseUrl?: string; publishableKey?: string; redirectUri?: string; apiUrl?: string; emailOtpEnabled?: string;
}): MobileAuthConfig | null {
  if (!values.supabaseUrl || !values.publishableKey || !values.redirectUri || !values.apiUrl) return null;
  const supabase = new URL(values.supabaseUrl);
  const redirect = new URL(values.redirectUri);
  const api = new URL(values.apiUrl);
  if (supabase.protocol !== 'https:' || supabase.pathname !== '/' || supabase.search || supabase.hash || supabase.username || supabase.password) throw new Error('Invalid authentication configuration');
  // Native callback only. Never silently use Expo Go, an OAuth proxy, or a guessed URI.
  if (!/^[a-z][a-z0-9+.-]*:$/.test(redirect.protocol) || ['http:', 'https:', 'exp:', 'exps:', 'javascript:', 'file:', 'data:'].includes(redirect.protocol) || redirect.username || redirect.password || redirect.search || redirect.hash) throw new Error('Invalid native redirect');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname);
  if ((api.protocol !== 'https:' && !(api.protocol === 'http:' && local)) || api.username || api.password || api.search || api.hash || !api.pathname.endsWith('/api/v1')) throw new Error('Invalid API URL');
  const key = values.publishableKey;
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') throw new Error();
    } catch { throw new Error('Only a publishable or anon key is allowed'); }
  }
  return { supabaseUrl: supabase.origin, publishableKey: key, redirectUri: values.redirectUri, apiUrl: values.apiUrl.replace(/\/$/, ''), emailOtpEnabled: values.emailOtpEnabled === 'true' };
}
