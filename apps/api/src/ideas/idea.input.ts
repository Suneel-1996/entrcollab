import { BadRequestException } from '@nestjs/common';
import type { IdeaProjectStatus, IdeaProjectVisibility } from '@prisma/client';
export interface IdeaInput { title: string; summary: string; description: string; neededSkills: string[]; tags: string[]; visibility: IdeaProjectVisibility }
export interface ListInput { limit: number; status?: IdeaProjectStatus; cursor?: { updatedAt: Date; id: string } }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
function invalid(): never { throw new BadRequestException('Invalid idea request'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false) {
  if (typeof value !== 'string') return invalid();
  const result = value.trim();
  if ((required && !result) || [...result].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\p{Surrogate}]/u.test(result)) return invalid();
  return result;
}
function tags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) return invalid();
  const values = value.map(v => text(v, 50, true));
  if (new Set(values.map(v => v.normalize('NFKC').toLowerCase())).size !== values.length) return invalid();
  return values;
}
export function parseIdea(value: unknown): IdeaInput {
  const body = object(value);
  if (Object.keys(body).some(key => !['title', 'summary', 'description', 'neededSkills', 'tags', 'visibility'].includes(key))) return invalid();
  const visibility = body.visibility === undefined ? 'PRIVATE' : body.visibility;
  if (visibility !== 'PRIVATE' && visibility !== 'MEMBERS') return invalid();
  return { title: text(body.title, 120, true), summary: text(body.summary === undefined ? '' : body.summary, 280), description: text(body.description === undefined ? '' : body.description, 5000), neededSkills: tags(body.neededSkills === undefined ? [] : body.neededSkills), tags: tags(body.tags === undefined ? [] : body.tags), visibility };
}
export function ideaId(value: string) { if (!UUID.test(value)) return invalid(); return value.toLowerCase(); }
export function emptyAction(value: unknown) { if (value !== undefined && Object.keys(object(value)).length) return invalid(); }
export function parseList(value: unknown, ownerId: string): ListInput {
  const query = object(value);
  if (Object.keys(query).some(key => !['status', 'limit', 'cursor'].includes(key))) return invalid();
  if (query.status !== undefined && (typeof query.status !== 'string' || !statuses.includes(query.status))) return invalid();
  let limit = 20;
  if (query.limit !== undefined) {
    if (typeof query.limit !== 'string' || !/^[1-9]\d?$/.test(query.limit) || Number(query.limit) > 50) return invalid();
    limit = Number(query.limit);
  }
  const status = query.status as IdeaProjectStatus | undefined;
  if (query.cursor === undefined) return { limit, status };
  if (typeof query.cursor !== 'string' || query.cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(query.cursor)) return invalid();
  try {
    const decoded = Buffer.from(query.cursor, 'base64url');
    if (decoded.toString('base64url') !== query.cursor) return invalid();
    const cursor = object(JSON.parse(decoded.toString('utf8')));
    if (Object.keys(cursor).sort().join(',') !== 'id,ownerId,status,updatedAt,v' || cursor.v !== 1 || cursor.ownerId !== ownerId || cursor.status !== (status ?? null) || typeof cursor.id !== 'string' || !UUID.test(cursor.id) || typeof cursor.updatedAt !== 'string') return invalid();
    const updatedAt = new Date(cursor.updatedAt);
    if (!Number.isFinite(updatedAt.getTime()) || updatedAt.getUTCFullYear() < 1970 || updatedAt.getUTCFullYear() > 9999 || updatedAt.toISOString() !== cursor.updatedAt) return invalid();
    return { limit, status, cursor: { updatedAt, id: cursor.id.toLowerCase() } };
  } catch { return invalid(); }
}
export function nextCursor(ownerId: string, status: IdeaProjectStatus | undefined, record: { id: string; updatedAt: Date }) {
  // Untrusted paging position, not an authorization credential. Never looks up a
  // cursor row outside the authenticated owner's SQL scope.
  return Buffer.from(JSON.stringify({ v: 1, ownerId, status: status ?? null, updatedAt: record.updatedAt.toISOString(), id: record.id })).toString('base64url');
}
