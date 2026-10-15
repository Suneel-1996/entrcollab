export interface Session { access_token: string; expires_at?: number }
export interface CurrentUser { id: string; status: string; createdAt: string; updatedAt: string }
export interface SessionPort {
  restore(): Promise<Session | null>;
  subscribe(listener: (session: Session | null) => void): () => void;
  signOut(): Promise<{ remoteRevoked: boolean }>;
  refresh(active: boolean): void;
}
export interface AuthState {
  phase: 'loading' | 'signedOut' | 'signedIn' | 'busy' | 'error';
  user?: CurrentUser;
  message?: string;
}
export class AccessFailure extends Error { constructor(readonly status: number) { super('Authentication request failed'); } }
export class SessionManager {
  private state: AuthState = { phase: 'loading' };
  private epoch = 0;
  private unsubscribe?: () => void;
  private listeners = new Set<(state: AuthState) => void>();
  private signingOut = false;
  private active = true;
  private expiry?: ReturnType<typeof setTimeout>;
  constructor(private readonly port: SessionPort, private readonly me: (token: string) => Promise<CurrentUser>) {}
  get snapshot() { return this.state; }
  subscribe(listener: (state: AuthState) => void) { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  private publish(state: AuthState) { this.state = state; for (const listener of this.listeners) listener(state); }
  async start() {
    this.port.refresh(this.active);
    this.unsubscribe = this.port.subscribe(session => {
      if (!this.signingOut) queueMicrotask(() => { if (!this.signingOut) void this.accept(session); });
    });
    await this.restore();
  }
  async restore() {
    const epoch = ++this.epoch; this.publish({ phase: 'loading' });
    try { const session = await this.port.restore(); if (epoch === this.epoch) await this.accept(session); }
    catch { if (epoch === this.epoch) this.publish({ phase: 'error', message: 'Unable to restore your session. Please retry.' }); }
  }
  private async accept(session: Session | null) {
    const epoch = ++this.epoch;
    if (this.expiry) clearTimeout(this.expiry);
    if (!session) { this.publish({ phase: 'signedOut' }); return; }
    if (!session.expires_at || session.expires_at * 1000 <= Date.now()) {
      await this.signOut('Your session expired. Please sign in again.'); return;
    }
    this.expiry = setTimeout(() => { void this.restore(); }, Math.min(session.expires_at * 1000 - Date.now(), 2_147_483_647));
    this.port.refresh(this.active);
    this.publish({ phase: 'loading' });
    try {
      const user = await this.me(session.access_token);
      if (epoch === this.epoch) this.publish({ phase: 'signedIn', user });
    } catch (error) {
      if (epoch !== this.epoch) return;
      if (error instanceof AccessFailure && [401, 403].includes(error.status)) {
        await this.signOut(error.status === 403 ? 'This account cannot sign in. Contact the development administrator.' : 'Your session expired. Please sign in again.');
      } else this.publish({ phase: 'error', message: 'Unable to contact the service. Please retry.' });
    }
  }
  async signOut(message?: string) {
    ++this.epoch; if (this.expiry) clearTimeout(this.expiry); this.signingOut = true; this.port.refresh(false); this.publish({ phase: 'busy' });
    try {
      const result = await this.port.signOut();
      this.publish({ phase: 'signedOut', message: message ?? (result.remoteRevoked ? undefined : 'Signed out on this device. Server revocation could not be confirmed.') });
    } catch { this.publish({ phase: 'error', message: 'Unable to clear secure storage. Please retry sign-out.' }); }
    finally { this.signingOut = false; }
  }
  foreground(active: boolean) { this.active = active; this.port.refresh(active); if (active && !this.signingOut) void this.restore(); }
  stop() { ++this.epoch; if (this.expiry) clearTimeout(this.expiry); this.unsubscribe?.(); this.port.refresh(false); this.listeners.clear(); }
}
