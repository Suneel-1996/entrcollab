import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIdea, parseList, nextCursor, emptyAction, ideaId } from '../src/ideas/idea.input';
import { IdeaService } from '../src/ideas/idea.service';
import type { IdeaRepository } from '../src/ideas/idea.repository';
const owner = 'aa111111-1111-4111-8111-111111111111';
const id = 'bb222222-2222-4222-8222-222222222222';

test('idea input normalizes full replacements with private defaults and explicit sharing', () => {
  assert.deepEqual(parseIdea({ title: ' Example ' }), { title: 'Example', summary: '', description: '', neededSkills: [], tags: [], visibility: 'PRIVATE' });
  const input = parseIdea({ title: '🧑'.repeat(120), summary: 's'.repeat(280), description: 'd'.repeat(5000), neededSkills: Array.from({ length: 20 }, (_, i) => `${i}`.padEnd(50, 'x')), tags: [' Climate '], visibility: 'MEMBERS' });
  assert.equal(input.visibility, 'MEMBERS'); assert.deepEqual(input.tags, ['Climate']);
});
test('strict input rejects ownership/state/time injection and malformed or excessive content', () => {
  const invalid: unknown[] = [null, [], 'title', {}, { title: ' ' }, { title: 'a'.repeat(121) }, { title: 'T', summary: 'a'.repeat(281) }, { title: 'T', description: 'a'.repeat(5001) },
    { title: 'T', summary: null }, { title: 'T', neededSkills: null }, { title: 'T', tags: 'wrong' }, { title: 'T', neededSkills: ['A', ' a '] }, { title: 'T', tags: ['Ａ', 'a'] },
    { title: 'T', tags: [''] }, { title: 'T', tags: ['a'.repeat(51)] }, { title: 'T', neededSkills: Array(21).fill('item') }, { title: 'T', tags: [2] },
    { title: 'T', visibility: null }, { title: 'T', visibility: 'PUBLIC' }, { title: 'bad\u0000' }, { title: 'bad\ud800' }];
  for (const key of ['id', 'ownerId', 'status', 'createdAt', 'publishedAt', 'archivedAt', 'role', 'owner', 'extra']) invalid.push({ title: 'T', [key]: owner });
  for (const body of invalid) assert.throws(() => parseIdea(body), { message: 'Invalid idea request' });
});
test('bounded cursor pagination binds the owner and status without looking up arbitrary rows', () => {
  assert.deepEqual(parseList({}, owner), { limit: 20, status: undefined });
  const updatedAt = new Date('2026-01-01T00:00:00.000Z'); const cursor = nextCursor(owner, 'DRAFT', { id, updatedAt });
  assert.deepEqual(parseList({ limit: '50', status: 'DRAFT', cursor }, owner), { limit: 50, status: 'DRAFT', cursor: { id, updatedAt } });
  for (const query of [{ limit: '0' }, { limit: '51' }, { limit: '-1' }, { limit: '1.5' }, { limit: ['1', '2'] }, { status: 'PUBLIC' }, { cursor: 'bad!' }, { cursor: 'x'.repeat(1025) }, { ownerId: owner }, { status: 'PUBLISHED', cursor }, { cursor }, { sort: 'title' }]) assert.throws(() => parseList(query, owner), { message: 'Invalid idea request' });
  assert.throws(() => parseList({ cursor, status: 'DRAFT' }, id), { message: 'Invalid idea request' });
});
test('malformed cursor payload/date and action/body fields fail closed', () => {
  const base = { v: 1, ownerId: owner, status: null, id, updatedAt: '2026-01-01T00:00:00.000Z' };
  for (const value of [{ ...base, v: 2 }, { ...base, updatedAt: 'invalid' }, { ...base, updatedAt: '0000-01-01T00:00:00.000Z' }, { ...base, id: 'bad' }, { ...base, extra: true }, null, []]) {
    assert.throws(() => parseList({ cursor: Buffer.from(JSON.stringify(value)).toString('base64url') }, owner), { message: 'Invalid idea request' });
  }
  emptyAction(undefined); emptyAction({});
  for (const body of [null, [], '', { visibility: 'MEMBERS' }, { status: 'PUBLISHED' }]) assert.throws(() => emptyAction(body), { message: 'Invalid idea request' });
  assert.equal(ideaId(id.toUpperCase()), id); assert.throws(() => ideaId('bad'), { message: 'Invalid idea request' });
});
test('database failures across every idea operation produce generic 503 without sensitive details', async () => {
  const fail = async () => { throw new Error('DB_PASSWORD PRIVATE_IDEA_SENTINEL TOKEN_SENTINEL'); };
  const repository: IdeaRepository = { create: fail, list: fail, read: fail, replace: fail, transition: fail };
  const service = new IdeaService(repository);
  for (const run of [() => service.create(owner, { title: 'T' }), () => service.list(owner, {}), () => service.read(owner, id), () => service.replace(owner, id, { title: 'T' }), () => service.action(owner, id, {}, 'PUBLISHED')]) {
    await assert.rejects(run, error => {
      const response = error as { getStatus(): number; getResponse(): unknown };
      assert.equal(response.getStatus(), 503); assert.doesNotMatch(JSON.stringify(response.getResponse()), /DB_PASSWORD|PRIVATE_IDEA_SENTINEL|TOKEN_SENTINEL/); return true;
    });
  }
});
