export interface OAuthPort {
  begin(redirectTo: string): Promise<{ url: string; flowId: string }>;
  open(url: string, redirectUri: string): Promise<{ type: string; url?: string }>;
  exchange(code: string, flowId: string): Promise<void>;
}
export class OAuthCoordinator {
  private active = false;
  constructor(private readonly port: OAuthPort, private readonly origin: string, private readonly redirectUri: string, private readonly nonce: () => string, private readonly now = Date.now) {}
  async signIn(): Promise<'complete' | 'cancelled'> {
    if (this.active) throw new Error('Sign-in already in progress');
    this.active = true;
    try {
      const state = this.nonce(); const started = this.now();
      const target = new URL(this.redirectUri); target.searchParams.set('auth_attempt', state);
      const flow = await this.port.begin(target.toString());
      const authorization = new URL(flow.url);
      if (authorization.username || authorization.password || authorization.hash || authorization.origin !== this.origin || authorization.pathname !== '/auth/v1/authorize' || authorization.searchParams.get('provider') !== 'google' || authorization.searchParams.get('code_challenge_method')?.toLowerCase() !== 's256' || !authorization.searchParams.get('code_challenge')) throw new Error('Unsafe authentication flow');
      const providerRedirect = new URL(authorization.searchParams.get('redirect_to') ?? '');
      if (providerRedirect.username || providerRedirect.password || providerRedirect.protocol !== target.protocol || providerRedirect.host !== target.host || providerRedirect.pathname !== target.pathname || providerRedirect.searchParams.get('auth_attempt') !== state) throw new Error('Unsafe authentication flow');
      const result = await this.port.open(flow.url, this.redirectUri);
      if (result.type === 'cancel' || result.type === 'dismiss') return 'cancelled';
      if (result.type !== 'success' || !result.url || this.now() - started > 5 * 60_000) throw new Error('Invalid authentication response');
      const callback = new URL(result.url);
      const one = (key: string) => callback.searchParams.getAll(key).length === 1;
      if (callback.username || callback.password || callback.protocol !== target.protocol || callback.host !== target.host || callback.pathname !== target.pathname || callback.hash || !one('auth_attempt') || callback.searchParams.get('auth_attempt') !== state || !one('code') || !callback.searchParams.get('code') || callback.searchParams.getAll('sb_flow_id').length > 1 || (callback.searchParams.has('sb_flow_id') && callback.searchParams.get('sb_flow_id') !== flow.flowId) || callback.searchParams.has('error') || callback.searchParams.has('access_token')) throw new Error('Invalid authentication response');
      // The attempt exists only for this browser invocation; callbacks cannot be replayed.
      // Supabase does not append sb_flow_id by default. Use the flow ID captured
      // at initiation, never an untrusted callback value, to select the verifier.
      await this.port.exchange(callback.searchParams.get('code')!, flow.flowId);
      return 'complete';
    } finally { this.active = false; }
  }
}
