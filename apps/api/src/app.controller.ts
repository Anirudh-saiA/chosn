import { Controller, Get } from '@nestjs/common';
import { Client } from 'pg';
import Redis from 'ioredis';

@Controller()
export class AppController {
  @Get()
  root() {
    return { service: 'chosn-api', status: 'ok' };
  }

  /**
   * Proves the infra pipe end to end without any feature code: confirms
   * DATABASE_URL and REDIS_URL actually resolve to live instances, or
   * reports exactly which one doesn't.
   */
  @Get('health')
  async health() {
    const checks: Record<string, string> = { postgres: 'unconfigured', redis: 'unconfigured' };

    if (process.env.DATABASE_URL) {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await client.connect();
        await client.query('SELECT 1');
        checks.postgres = 'ok';
      } catch {
        checks.postgres = 'error';
      } finally {
        await client.end().catch(() => undefined);
      }
    }

    if (process.env.REDIS_URL) {
      const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
      try {
        await redis.connect();
        await redis.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'error';
      } finally {
        redis.disconnect();
      }
    }

    return { status: 'ok', checks };
  }
}
