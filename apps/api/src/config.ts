export function readConfig(env: NodeJS.ProcessEnv) {
  const port = Number(env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('DATABASE_URL must be a PostgreSQL URL'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.pathname.slice(1)) throw new Error('DATABASE_URL must be a PostgreSQL URL with host and database');
  return { port, host: env.HOST ?? '127.0.0.1' };
}
