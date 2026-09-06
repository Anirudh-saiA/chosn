import './instrument';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { AppModule } from './app.module';
import { ensurePricePartitions, runMigrations } from './db/migrate';

async function bootstrap() {
  if (process.env.DATABASE_URL) {
    const migrationPool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await runMigrations(migrationPool);
      await ensurePricePartitions(migrationPool);
    } catch (err) {
      // Don't crash boot over a migration hiccup — /health already
      // surfaces DB connectivity problems clearly.
      console.error('Migration failed:', err);
    } finally {
      await migrationPool.end();
    }
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.getHttpAdapter().getInstance().set('trust proxy', 1); // Railway/Vercel sit behind a proxy

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`chosn-api listening on :${port}`);
}

bootstrap();
