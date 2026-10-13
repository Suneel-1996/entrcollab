export interface AuthConfig {
  issuer: string;
  jwksUrl: URL;
  audience: 'authenticated';
  emailOtpEnabled: boolean;
  devEmails: ReadonlySet<string>;
}

export function readAuthConfig(env: NodeJS.ProcessEnv): AuthConfig | null {
  if (!env.SUPABASE_URL) return null;
  let url: URL;
  try { url = new URL(env.SUPABASE_URL); } catch { throw new Error('Invalid Supabase configuration'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Supabase URL must be an HTTPS origin');
  }
  const emailOtpEnabled = env.AUTH_EMAIL_OTP_ENABLED === 'true';
  const devEmails = new Set((env.AUTH_DEV_EMAIL_ALLOWLIST ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean));
  if (emailOtpEnabled && (env.NODE_ENV === 'production' || devEmails.size === 0)) {
    throw new Error('Development email OTP requires a nonproduction tester allowlist');
  }
  return {
    issuer: `${url.origin}/auth/v1`, jwksUrl: new URL(`${url.origin}/auth/v1/.well-known/jwks.json`),
    audience: 'authenticated', emailOtpEnabled, devEmails,
  };
}
export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
