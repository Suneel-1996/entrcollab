import 'reflect-metadata';
import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database.service';
import { PrismaProfileRepository } from '../src/profiles/profile.repository';
import { parseProfile } from '../src/profiles/profile.input';

test('profile migration, unique ownership, private defaults, concurrent atomic writes and restricted target filtering', async () => {
  const db = new DatabaseService(); const repository = new PrismaProfileRepository(db); const id = randomUUID();
  try {
    await db.applicationUser.create({ data: { id, providerSubject: randomUUID() } });
    assert.equal(await repository.own(id), null);
    const writes = Array.from({ length: 12 }, (_, i) => parseProfile({ displayName: `User ${i}`, bio: `Bio ${i}`, visibility: { displayName: 'MEMBERS' } }));
    const results = await Promise.all(writes.map(input => repository.replace(id, input)));
    assert.equal(new Set(results.map(p => p.userId)).size, 1);
    assert.equal(await db.profile.count({ where: { userId: id } }), 1);
    const saved = (await repository.own(id))!;
    assert.equal(saved.bio, `Bio ${saved.displayName.split(' ')[1]}`); assert.equal(saved.bioVisibility, 'PRIVATE');
    assert.ok(await repository.member(id));
    await assert.rejects(db.profile.create({ data: { userId: id, displayName: 'Duplicate' } }), { code: 'P2002' });
    await db.applicationUser.update({ where: { id }, data: { status: 'SUSPENDED' } });
    assert.equal(await repository.member(id), null);
    await assert.rejects(repository.replace(id, writes[0]), { message: 'Access denied' });
    await db.applicationUser.update({ where: { id }, data: { status: 'ACTIVE', deletionRequestedAt: new Date() } });
    assert.equal(await repository.member(id), null);
    await assert.rejects(repository.replace(id, writes[0]), { message: 'Access denied' });
    await db.applicationUser.update({ where: { id }, data: { deletionRequestedAt: null } });
    const privateProfile = await repository.replace(id, parseProfile({ displayName: 'Private' }));
    assert.equal(privateProfile.displayNameVisibility, 'PRIVATE'); assert.equal(privateProfile.bio, '');
    await assert.rejects(db.applicationUser.delete({ where: { id } }), { code: 'P2003' });
    const orphan = randomUUID(); await assert.rejects(db.profile.create({ data: { userId: orphan, displayName: 'Orphan' } }), { code: 'P2003' });
    assert.ok(privateProfile.createdAt instanceof Date); assert.ok(privateProfile.updatedAt instanceof Date);
  } finally {
    await db.profile.deleteMany({ where: { userId: id } });
    await db.applicationUser.deleteMany({ where: { id } }); await db.$disconnect();
  }
});
