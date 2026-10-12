import 'reflect-metadata';
import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../src/database.service';
test('Prisma queries PostgreSQL and reports unreachable database safely', async () => {
  const database = new DatabaseService();
  const unavailable = new DatabaseService({ datasources: { db: { url: 'postgresql://unused:unused@127.0.0.1:1/unavailable?connect_timeout=1' } } });
  try { assert.equal(await database.isReady(), true); assert.equal(await unavailable.isReady(), false); } finally { await database.onModuleDestroy(); await unavailable.onModuleDestroy(); }
});
