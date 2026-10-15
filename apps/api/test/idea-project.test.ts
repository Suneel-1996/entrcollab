import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDEA_TRANSITIONS, canReadIdeaProject, canTransitionIdeaProject, ideaTransitionFields, type IdeaActor, type IdeaPolicyRecord } from '../src/ideas/idea-project.policy';
import type { IdeaProjectStatus } from '@prisma/client';
const owner: IdeaActor = { id: 'owner', status: 'ACTIVE', deletionRequestedAt: null };
const member: IdeaActor = { id: 'member', status: 'ACTIVE', deletionRequestedAt: null };
const createdAt = new Date('2026-01-01T00:00:00Z');
const publishedAt = new Date('2026-01-02T00:00:00Z');
const archivedAt = new Date('2026-01-03T00:00:00Z');
const states: IdeaProjectStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const idea: IdeaPolicyRecord = { ownerId: owner.id, status: 'DRAFT', visibility: 'PRIVATE', owner };
const restrictions = [{ status: 'ACTIVE', deletionRequestedAt: null }, { status: 'SUSPENDED', deletionRequestedAt: null }, { status: 'ACTIVE', deletionRequestedAt: createdAt }];

test('approved lifecycle graph allows publication or draft archive, with archive terminal', () => {
  assert.deepEqual(IDEA_TRANSITIONS, { DRAFT: ['PUBLISHED', 'ARCHIVED'], PUBLISHED: ['ARCHIVED'], ARCHIVED: [] });
});
test('anonymous, restricted callers and restricted owners never gain read access in any state/visibility', () => {
  for (const status of states) for (const visibility of ['PRIVATE', 'MEMBERS'] as const) {
    for (const ownerState of restrictions) for (const callerState of restrictions) for (const id of [owner.id, member.id]) {
      const actor = { id, ...callerState }; const record = { ...idea, owner: ownerState, status, visibility };
      const expected = callerState.status === 'ACTIVE' && callerState.deletionRequestedAt === null && ownerState.status === 'ACTIVE' && ownerState.deletionRequestedAt === null && (id === owner.id || status === 'PUBLISHED' && visibility === 'MEMBERS');
      assert.equal(canReadIdeaProject(actor, record), expected);
      assert.equal(canReadIdeaProject(null, record), false);
    }
  }
});
test('only active owner can execute a permitted lifecycle edge; no implicit restoration/unpublish', () => {
  for (const status of states) for (const next of states) for (const actor of [owner, member, null, { ...owner, status: 'SUSPENDED' }, { ...owner, deletionRequestedAt: createdAt }]) {
    assert.equal(canTransitionIdeaProject(actor, { ...idea, status }, next), actor === owner && IDEA_TRANSITIONS[status].includes(next));
    assert.equal(canTransitionIdeaProject(actor, { ...idea, status, owner: { ...owner, status: 'SUSPENDED' } }, next), false);
  }
});
test('publication sets time without automatically sharing a private record', () => {
  const record = { ...idea, createdAt, publishedAt: null, archivedAt: null };
  const changes = ideaTransitionFields(owner, record, 'PUBLISHED', publishedAt);
  assert.deepEqual(changes, { status: 'PUBLISHED', publishedAt, archivedAt: null });
  assert.equal(Object.hasOwn(changes, 'visibility'), false);
  assert.equal(canReadIdeaProject(member, { ...record, ...changes }), false);
  assert.equal(canReadIdeaProject(member, { ...record, ...changes, visibility: 'MEMBERS' }), true);
});
test('archiving draft or publication retains correct history and masks shared visibility', () => {
  for (const status of ['DRAFT', 'PUBLISHED'] as const) {
    const record = { ...idea, status, visibility: 'MEMBERS' as const, createdAt, publishedAt: status === 'PUBLISHED' ? publishedAt : null, archivedAt: null };
    const changes = ideaTransitionFields(owner, record, 'ARCHIVED', archivedAt);
    assert.equal(changes.publishedAt, record.publishedAt); assert.equal(changes.archivedAt, archivedAt);
    assert.equal(canReadIdeaProject(member, { ...record, ...changes }), false);
    assert.equal(canReadIdeaProject(owner, { ...record, ...changes }), true);
    assert.throws(() => ideaTransitionFields(owner, { ...record, ...changes }, 'PUBLISHED', archivedAt), { message: 'Idea transition denied' });
  }
});
test('denied and invalid-time transitions produce no mutation of the original record', () => {
  const record = { ...idea, createdAt, publishedAt: null, archivedAt: null };
  assert.throws(() => ideaTransitionFields(member, record, 'PUBLISHED', publishedAt), { message: 'Idea transition denied' });
  for (const at of [new Date('invalid'), new Date(createdAt.getTime() - 1)]) assert.throws(() => ideaTransitionFields(owner, record, 'PUBLISHED', at), { message: 'Invalid idea transition time' });
  const published = { ...record, status: 'PUBLISHED' as const, publishedAt };
  assert.throws(() => ideaTransitionFields(owner, published, 'ARCHIVED', new Date(publishedAt.getTime() - 1)), { message: 'Invalid idea transition time' });
  assert.deepEqual(record, { ...idea, createdAt, publishedAt: null, archivedAt: null });
});
