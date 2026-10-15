import type { AuthState } from '../auth/session';
import type { ProfileRequest } from './client';
export function createProfileRequest(apiUrl: string, current: () => AuthState, access: () => Promise<{ access_token: string; expires_at?: number } | null>, fetcher: typeof fetch): ProfileRequest {
  return async (method, input) => {
    const initial = current();
    if (initial.phase !== 'signedIn' || !initial.user) return new Response(null, { status: 401 });
    const session = await access();
    const latest = current();
    if (!session?.expires_at || session.expires_at * 1000 <= Date.now() || latest.phase !== 'signedIn' || latest.user?.id !== initial.user.id) return new Response(null, { status: 401 });
    return fetcher(`${apiUrl}/profiles/me`, {
      method, headers: { Authorization: `Bearer ${session.access_token}`, ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method === 'PUT' ? { body: JSON.stringify(input) } : {}),
    });
  };
}
