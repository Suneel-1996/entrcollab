import 'reflect-metadata';
import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../src/database.service';
import { canReadIdeaProject, ideaTransitionFields } from '../src/ideas/idea-project.policy';

async function fixture(run: (db: DatabaseService, ownerId: string) => Promise<void>) {
  const db = new DatabaseService(); const ownerId = randomUUID();
  try {
    await db.applicationUser.create({ data: { id: ownerId, providerSubject: randomUUID() } });
    await run(db, ownerId);
  } finally {
    await db.ideaProject.deleteMany({ where: { ownerId } });
    await db.applicationUser.deleteMany({ where: { id: ownerId } }); await db.$disconnect();
  }
}
test('idea/project defaults, UUIDs, owner integrity and both composite indexes exist', async () => {
  await fixture(async (db, ownerId) => {
    const first = await db.ideaProject.create({ data: { ownerId, title: 'Fixture idea' } });
    const second = await db.ideaProject.create({ data: { ownerId, title: 'Another fixture' } });
    assert.notEqual(first.id, second.id); assert.match(first.id, /^[0-9a-f-]{36}$/);
    assert.equal(first.status, 'DRAFT'); assert.equal(first.visibility, 'PRIVATE');
    assert.equal(first.summary, ''); assert.equal(first.description, ''); assert.deepEqual(first.neededSkills, []); assert.deepEqual(first.tags, []);
    assert.equal(first.publishedAt, null); assert.equal(first.archivedAt, null); assert.ok(first.createdAt instanceof Date); assert.ok(first.updatedAt instanceof Date);
    await assert.rejects(db.ideaProject.create({ data: { ownerId: randomUUID(), title: 'Orphan' } }), { code: 'P2003' });
    await assert.rejects(db.applicationUser.delete({ where: { id: ownerId } }), { code: 'P2003' });
    const indexes = await db.$queryRaw<{ indexname: string; indexdef: string }[]>`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'IdeaProject'`;
    const ownerIndex = indexes.find(index => index.indexname === 'IdeaProject_owner_state_updated_idx');
    const visibilityIndex = indexes.find(index => index.indexname === 'IdeaProject_state_visibility_updated_idx');
    assert.match(ownerIndex?.indexdef ?? '', /"ownerId", status, "updatedAt" DESC, id DESC/);
    assert.match(visibilityIndex?.indexdef ?? '', /status, visibility, "updatedAt" DESC, id DESC/);
  });
});
test('database rejects inconsistent lifecycle dates, empty/overlong content and oversized lists', async () => {
  await fixture(async (db, ownerId) => {
    const createdAt = new Date('2026-01-01T00:00:00Z'); const later = new Date('2026-01-02T00:00:00Z');
    const invalid: Prisma.IdeaProjectUncheckedCreateInput[] = [
      { ownerId, title: '', createdAt }, { ownerId, title: '   ', createdAt }, { ownerId, title: 'x'.repeat(121), createdAt },
      { ownerId, title: 'Fixture', summary: 'x'.repeat(281), createdAt }, { ownerId, title: 'Fixture', description: 'x'.repeat(5001), createdAt },
      { ownerId, title: 'Fixture', neededSkills: Array.from({ length: 21 }, (_, i) => String(i)), createdAt },
      { ownerId, title: 'Fixture', tags: Array.from({ length: 21 }, (_, i) => String(i)), createdAt },
      { ownerId, title: 'Fixture', status: 'PUBLISHED', createdAt },
      { ownerId, title: 'Fixture', status: 'DRAFT', publishedAt: later, createdAt },
      { ownerId, title: 'Fixture', status: 'DRAFT', archivedAt: later, createdAt },
      { ownerId, title: 'Fixture', status: 'PUBLISHED', publishedAt: later, archivedAt: later, createdAt },
      { ownerId, title: 'Fixture', status: 'ARCHIVED', createdAt },
      { ownerId, title: 'Fixture', status: 'PUBLISHED', publishedAt: new Date(createdAt.getTime() - 1), createdAt },
      { ownerId, title: 'Fixture', status: 'ARCHIVED', archivedAt: new Date(createdAt.getTime() - 1), createdAt },
      { ownerId, title: 'Fixture', status: 'ARCHIVED', publishedAt: later, archivedAt: createdAt, createdAt },
    ];
    for (const data of invalid) await assert.rejects(db.ideaProject.create({ data }), error => (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2000') || (error instanceof Prisma.PrismaClientUnknownRequestError && /23514/.test(error.message) && /IdeaProject_.*_check/.test(error.message)));
    assert.equal(await db.ideaProject.count({ where: { ownerId } }), 0);
    const valid = await db.ideaProject.create({ data: { ownerId, title: 'Valid fixture' } });
    const checkViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010' && error.meta?.code === '23514';
    await assert.rejects(db.$executeRaw`UPDATE "IdeaProject" SET "neededSkills" = NULL WHERE id = ${valid.id}::uuid`, checkViolation);
    await assert.rejects(db.$executeRaw`UPDATE "IdeaProject" SET tags = ARRAY[NULL]::text[] WHERE id = ${valid.id}::uuid`, checkViolation);
    const preserved = await db.ideaProject.findUniqueOrThrow({ where: { id: valid.id } });
    assert.deepEqual(preserved.neededSkills, []); assert.deepEqual(preserved.tags, []);
  });
});
test('persisted publication stays private until explicitly shared and archive becomes owner-only', async () => {
  await fixture(async (db, ownerId) => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    let idea = await db.ideaProject.create({ data: { ownerId, title: 'Fixture', createdAt }, include: { owner: true } });
    const actor = { id: ownerId, status: 'ACTIVE', deletionRequestedAt: null }; const member = { ...actor, id: randomUUID() };
    const publish = ideaTransitionFields(actor, idea, 'PUBLISHED', new Date('2026-01-02T00:00:00Z'));
    idea = await db.ideaProject.update({ where: { id: idea.id }, data: publish, include: { owner: true } });
    assert.equal(idea.visibility, 'PRIVATE'); assert.equal(canReadIdeaProject(member, idea), false);
    idea = await db.ideaProject.update({ where: { id: idea.id }, data: { visibility: 'MEMBERS' }, include: { owner: true } });
    assert.equal(canReadIdeaProject(member, idea), true);
    const archive = ideaTransitionFields(actor, idea, 'ARCHIVED', new Date('2026-01-03T00:00:00Z'));
    idea = await db.ideaProject.update({ where: { id: idea.id }, data: archive, include: { owner: true } });
    assert.equal(canReadIdeaProject(member, idea), false); assert.equal(canReadIdeaProject(actor, idea), true);
    assert.equal(idea.publishedAt?.toISOString(), '2026-01-02T00:00:00.000Z');
    assert.throws(() => ideaTransitionFields(actor, idea, 'PUBLISHED', new Date('2026-01-04T00:00:00Z')), { message: 'Idea transition denied' });
    const draft = await db.ideaProject.create({ data: { ownerId, title: 'Archive without publishing', createdAt }, include: { owner: true } });
    const archivedDraft = await db.ideaProject.update({ where: { id: draft.id }, data: ideaTransitionFields(actor, draft, 'ARCHIVED', new Date('2026-01-02T00:00:00Z')) });
    assert.equal(archivedDraft.publishedAt, null); assert.ok(archivedDraft.archivedAt);
  });
});
