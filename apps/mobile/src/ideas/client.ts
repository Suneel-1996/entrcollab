import { draftFor, statuses, uuid, validate, type Idea, type IdeaInput, type Status } from './model';
export interface Route { id?: string; action?: 'publish' | 'archive'; query?: { status?: Status; cursor?: string } }
export type IdeaRequest = (method: 'GET' | 'POST' | 'PUT', route: Route, input?: IdeaInput) => Promise<Response>;
export type FailureKind = 'validation' | 'unauthorized' | 'forbidden' | 'missing' | 'conflict' | 'unavailable' | 'network';
export class IdeaFailure extends Error { constructor(readonly kind: FailureKind) { super('Idea request failed'); } }
function invalid(): never { throw new IdeaFailure('unavailable'); }
function date(value: unknown) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function body(value: unknown, userId: string, id?: string): Idea {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const b = value as Idea;
  if (typeof b.id !== 'string' || !uuid.test(b.id) || (id && b.id !== id) || b.ownerId !== userId || !statuses.includes(b.status) || !date(b.createdAt) || !date(b.updatedAt) || (b.publishedAt !== null && !date(b.publishedAt)) || (b.archivedAt !== null && !date(b.archivedAt))) return invalid();
  if (typeof b.title !== 'string' || typeof b.summary !== 'string' || typeof b.description !== 'string' || !Array.isArray(b.neededSkills) || !Array.isArray(b.tags) || [...b.neededSkills, ...b.tags].some(v => typeof v !== 'string')) return invalid();
  if (Object.keys(validate(b).errors).length || (b.status === 'DRAFT' && (b.publishedAt || b.archivedAt)) || (b.status === 'PUBLISHED' && (!b.publishedAt || b.archivedAt)) || (b.status === 'ARCHIVED' && !b.archivedAt)) return invalid();
  return { ...draftFor(b), id: b.id, ownerId: b.ownerId, status: b.status, createdAt: b.createdAt, updatedAt: b.updatedAt, publishedAt: b.publishedAt, archivedAt: b.archivedAt };
}
export function validCursor(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 1024 && /^[A-Za-z0-9_-]+$/.test(value); }
export class IdeaClient {
  constructor(private readonly request: IdeaRequest) {}
  private async execute(method: 'GET' | 'POST' | 'PUT', route: Route, input?: IdeaInput): Promise<unknown> {
    let response: Response;
    try { response = await this.request(method, route, input); } catch { throw new IdeaFailure('network'); }
    if (!response.ok) throw new IdeaFailure(response.status === 400 ? 'validation' : response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : response.status === 404 ? 'missing' : response.status === 409 ? 'conflict' : 'unavailable');
    try { return await response.json(); } catch { return invalid(); }
  }
  async list(userId: string, status?: Status, cursor?: string) {
    const value = await this.execute('GET', { query: { status, cursor } });
    if (!value || typeof value !== 'object') return invalid();
    const page = value as { items: unknown[]; nextCursor: unknown };
    if (!Array.isArray(page.items) || page.items.length > 20 || (page.nextCursor !== null && (!validCursor(page.nextCursor) || page.nextCursor === cursor))) return invalid();
    const items = page.items.map(v => body(v, userId));
    if (items.some(v => status && v.status !== status) || new Set(items.map(v => v.id)).size !== items.length) return invalid();
    return { items, nextCursor: page.nextCursor as string | null };
  }
  async read(userId: string, id: string) { return body(await this.execute('GET', { id }), userId, id); }
  async save(userId: string, input: IdeaInput, id?: string) { return body(await this.execute(id ? 'PUT' : 'POST', id ? { id } : {}, input), userId, id); }
  async action(userId: string, id: string, action: 'publish' | 'archive') { return body(await this.execute('POST', { id, action }), userId, id); }
}
