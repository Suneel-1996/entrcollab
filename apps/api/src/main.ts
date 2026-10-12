import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readConfig } from './config';
async function main() {
  const config = readConfig(process.env);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
}
void main().catch(() => { console.error('API startup failed; check configuration and service availability.'); process.exitCode = 1; });
