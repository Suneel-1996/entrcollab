import { BadRequestException } from '@nestjs/common';

export const PROFILE_FIELDS = ['displayName', 'bio', 'skills', 'interests', 'availability'] as const;
export type ProfileField = typeof PROFILE_FIELDS[number];
export type Visibility = 'PRIVATE' | 'MEMBERS';
export interface ProfileInput {
  displayName: string; bio: string; skills: string[]; interests: string[]; availability: string;
  visibility: Record<ProfileField, Visibility>;
}
function invalid(): never { throw new BadRequestException('Invalid profile'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string') return invalid();
  const result = value.trim();
  if ((required && !result) || [...result].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result)) return invalid();
  return result;
}
function list(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) return invalid();
  const values = value.map(v => text(v, 50, true));
  if (new Set(values.map(v => v.normalize('NFKC').toLowerCase())).size !== values.length) return invalid();
  return values;
}
export function parseProfile(value: unknown): ProfileInput {
  const body = object(value);
  if (Object.keys(body).some(key => ![...PROFILE_FIELDS, 'visibility'].includes(key as ProfileField))) return invalid();
  const settings = body.visibility === undefined ? {} : object(body.visibility);
  if (Object.keys(settings).some(key => !PROFILE_FIELDS.includes(key as ProfileField))) return invalid();
  const visibility = {} as Record<ProfileField, Visibility>;
  for (const field of PROFILE_FIELDS) {
    const option = settings[field] ?? 'PRIVATE';
    if (option !== 'PRIVATE' && option !== 'MEMBERS') return invalid();
    if (Object.hasOwn(settings, field) && settings[field] === null) return invalid();
    visibility[field] = option;
  }
  return { displayName: text(body.displayName, 80, true), bio: text(body.bio === undefined ? '' : body.bio, 2000),
    skills: list(body.skills === undefined ? [] : body.skills), interests: list(body.interests === undefined ? [] : body.interests), availability: text(body.availability === undefined ? '' : body.availability, 200), visibility };
}
