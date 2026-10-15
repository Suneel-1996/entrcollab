export interface SecureDriver {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
interface Manifest { id: string; count: number }
// SDK session JSON can exceed a platform's single Keychain item limit. All chunks
// and the manifest stay in platform secure storage; no AsyncStorage fallback.
export class ChunkedSecureStorage implements SecureDriver {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly driver: SecureDriver, private readonly randomId: () => string) {}
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn, fn); this.tail = next.catch(() => undefined); return next;
  }
  private async manifest(key: string): Promise<Manifest | null> {
    if (!/^[a-zA-Z0-9._-]+$/.test(key)) throw new Error('Secure storage unavailable');
    const raw = await this.driver.getItem(key);
    if (!raw) return null;
    const m = JSON.parse(raw) as Manifest;
    if (!/^[a-zA-Z0-9-]+$/.test(m.id) || !Number.isInteger(m.count) || m.count < 1 || m.count > 160) throw new Error('Secure storage unavailable');
    return m;
  }
  private async cleanup(key: string, m: Manifest) {
    for (let i = 0; i < m.count; i++) await this.driver.removeItem(`${key}.${m.id}.${i}`);
  }
  getItem(key: string): Promise<string | null> {
    return this.serial(async () => {
      const m = await this.manifest(key); if (!m) return null;
      let value = '';
      for (let i = 0; i < m.count; i++) {
        const part = await this.driver.getItem(`${key}.${m.id}.${i}`);
        if (part === null) throw new Error('Secure storage unavailable');
        value += part;
      }
      return decodeURIComponent(value);
    });
  }
  setItem(key: string, value: string): Promise<void> {
    return this.serial(async () => {
      const old = await this.manifest(key); const encoded = encodeURIComponent(value);
      const next = { id: this.randomId(), count: Math.max(1, Math.ceil(encoded.length / 1600)) };
      if (next.count > 160) throw new Error('Secure storage unavailable');
      try {
        for (let i = 0; i < next.count; i++) await this.driver.setItem(`${key}.${next.id}.${i}`, encoded.slice(i * 1600, (i + 1) * 1600));
        await this.driver.setItem(key, JSON.stringify(next));
      } catch { await this.cleanup(key, next); throw new Error('Secure storage unavailable'); }
      if (old) await this.cleanup(key, old);
    });
  }
  removeItem(key: string): Promise<void> {
    return this.serial(async () => {
      const m = await this.manifest(key);
      // Delete encrypted chunks as well as the lookup. Do not report logout complete on failure.
      if (m) await this.cleanup(key, m);
      await this.driver.removeItem(key);
    });
  }
}
