import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config';
const DATABASE_URL = 'postgresql://user:example@localhost:5432/test';
test('valid configuration and defaults', () => { assert.deepEqual(readConfig({ DATABASE_URL }), { port: 3000, host: '127.0.0.1' }); assert.equal(readConfig({ DATABASE_URL, PORT: '4000' }).port, 4000); });
for (const PORT of ['0', '65536', '1.5', 'bad', '']) test(`reject invalid port ${PORT}`, () => assert.throws(() => readConfig({ DATABASE_URL, PORT }), /PORT/));
for (const value of [undefined, 'invalid', 'https://localhost/db', 'postgresql://localhost']) test(`reject invalid database URL ${value}`, () => assert.throws(() => readConfig({ DATABASE_URL: value }), /DATABASE_URL/));
