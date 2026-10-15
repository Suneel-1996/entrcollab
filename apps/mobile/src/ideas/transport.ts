import type { AuthState } from '../auth/session';
import { validCursor, type IdeaRequest } from './client';
import { statuses, uuid } from './model';
export function createIdeaRequest(apiUrl: string, current: () => AuthState, access: () => Promise<{ access_token: string; expires_at?: number } | null>, fetcher: typeof fetch): IdeaRequest {
  return async (method, route, input) => {
    if ((route.id !== undefined && !uuid.test(route.id)) || (route.action !== undefined && (!route.id || !['publish', 'archive'].includes(route.action) || method !== 'POST')) || (route.query && (route.id || method !== 'GET' || (route.query.status !== undefined && !statuses.includes(route.query.status)) || (route.query.cursor !== undefined && !validCursor(route.query.cursor)))) || (method === 'PUT' && !route.id) || (method === 'POST' && route.id && !route.action)) throw new Error('Invalid idea route');
    const initial = current();
    if (initial.phase !== 'signedIn' || !initial.user) return new Response(null, { status: 401 });
    const session = await access();
    const latest = current();
    if (!session?.expires_at || session.expires_at * 1000 <= Date.now() || latest.phase !== 'signedIn' || latest.user?.id !== initial.user.id) return new Response(null, { status: 401 });
    const query = new URLSearchParams();
    if (route.query?.status) query.set('status', route.query.status);
    if (route.query?.cursor) query.set('cursor', route.query.cursor);
    // The installed native WHATWG polyfill has no URLSearchParams.size.
    const serialized = query.toString();
    const suffix = serialized ? `?${serialized}` : '';
    return fetcher(`${apiUrl}/ideas${route.id ? `/${route.id}` : ''}${route.action ? `/${route.action}` : ''}${suffix}`, {
      method, headers: { Authorization: `Bearer ${session.access_token}`, ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method !== 'GET' ? { body: JSON.stringify(route.action ? {} : input) } : {}),
    });
  };
}
