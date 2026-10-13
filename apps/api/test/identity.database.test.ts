import 'reflect-metadata';
import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database.service';
import { PrismaIdentityRepository } from '../src/auth/identity.repository';

test('migration, unique identity, concurrent provisioning and account-state preservation', async () => {
  const db = new DatabaseService(); const repository = new PrismaIdentityRepository(db); const subject = randomUUID();
  try {
    const users = await Promise.all(Array.from({ length: 20 }, () => repository.getOrCreate(subject)));
    assert.equal(new Set(users.map(u => u.id)).size, 1);
    assert.equal(await db.applicationUser.count({ where: { providerSubject: subject } }), 1);
    assert.notEqual(users[0].id, subject); assert.equal(users[0].status, 'ACTIVE');
    await assert.rejects(db.applicationUser.create({ data: { providerSubject: subject } }), { code: 'P2002' });
    const deletedAt = new Date();
    await db.applicationUser.update({ where: { providerSubject: subject }, data: { status: 'SUSPENDED', deletionRequestedAt: deletedAt } });
    const again = await repository.getOrCreate(subject);
    assert.equal(again.status, 'SUSPENDED'); assert.equal(again.deletionRequestedAt?.getTime(), deletedAt.getTime());
    assert.equal(again.id, users[0].id);
  } finally {
    await db.applicationUser.deleteMany({ where: { providerSubject: subject } });
    await db.$disconnect();
  }
});
