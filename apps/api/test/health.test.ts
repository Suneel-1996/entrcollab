import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { HealthController } from '../src/health.controller';
import { DatabaseService } from '../src/database.service';
for (const available of [true, false]) {
  test(`health routes with database available=${available}`, async () => {
    @Module({ controllers: [HealthController], providers: [{ provide: DatabaseService, useValue: { isReady: async () => available } }] })
    class TestModule {}
    const app = await NestFactory.create(TestModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    await app.init();
    try {
      const live = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      assert.deepEqual(live.body, { status: 'ok' });
      const ready = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(available ? 200 : 503);
      assert.deepEqual(ready.body, { status: available ? 'ok' : 'unavailable' });
      await request(app.getHttpServer()).get('/health').expect(404);
      await request(app.getHttpServer()).post('/api/v1/health').expect(404);
    } finally { await app.close(); }
  });
}
