import './instrument';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';
import { Pool } from 'pg';
import { AppModule } from './app.module';
import { parseAllowedOrigins } from './common/cors-origins';
import { SentryExceptionFilter } from './common/sentry-exception.filter';
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

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Day 27: WEB_ORIGIN is now comma-separated (see cors-origins.ts) so
  // both the production and staging Vercel URLs can be allowed at once
  // — a single-origin WEB_ORIGIN (or none set) behaves exactly as
  // before.
  app.enableCors({ origin: parseAllowedOrigins(process.env.WEB_ORIGIN) });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new SentryExceptionFilter(app.get(HttpAdapterHost).httpAdapter));
  // Day 26: Legit Check post photos now go straight to object storage
  // (community/storage.service.ts) — nothing is written to or served
  // from local disk anymore, so no static-assets mount here.
  // Nest has no default WebSocket transport of its own — without this,
  // @WebSocketGateway falls back to trying Socket.io, which isn't
  // installed (this app uses plain `ws` — see DropLiveGateway's own
  // comment on why). No origin restriction on the ws upgrade itself:
  // DropLiveGateway only ever broadcasts public drop-status events, and
  // accepts no messages back from a client, so there's nothing an
  // arbitrary origin could read or do beyond what /catalog already
  // serves unauthenticated — unlike the REST endpoints in this app,
  // which stay behind the enableCors origin check above.
  app.useWebSocketAdapter(new WsAdapter(app));
  app.getHttpAdapter().getInstance().set('trust proxy', 1); // Railway/Vercel sit behind a proxy

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`chosn-api listening on :${port}`);
}

bootstrap();
