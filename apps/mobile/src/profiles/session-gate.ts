import type { AuthState } from '../auth/session';
export interface ProfileGate { userId: string | null; revision: number; visible: boolean }
export const initialProfileGate: ProfileGate = { userId: null, revision: 0, visible: false };
// Keep drafts only through temporary revalidation. Any logout/error clears the
// account key; revision prevents same-account login from reusing an old screen.
export function profileGateForAuth(previous: ProfileGate, state: AuthState): ProfileGate {
  if (state.phase === 'signedIn' && state.user) return {
    userId: state.user.id, visible: true,
    revision: previous.userId === state.user.id ? previous.revision : previous.revision + 1,
  };
  if (state.phase === 'loading') return { ...previous, visible: false };
  return { userId: null, revision: previous.revision + 1, visible: false };
}
