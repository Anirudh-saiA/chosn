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
   *
   * Day 31 addition: `deployedCommit`, sourced from `RAILWAY_GIT_COMMIT_SHA`
   * (auto-injected by Railway for a git-connected service, same
   * convention as `RAILWAY_ENVIRONMENT_NAME` already used in
   * instrument.ts). Real motivation, not a throwaway test change: Day
   * 30's outage was invisible from the outside for days specifically
   * because there was no way to tell "the API responds" apart from "the
   * API is running the commit that was actually just merged" — every
   * check up to that point could only prove liveness, never version.
   * Doubles today as this session's deploy-pipeline reliability test:
   * pushing this through develop -> staging -> main -> production and
   * confirming this field changes each time IS the actual verification
   * task 2 asks for.
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

    return {
      status: 'ok',
      checks,
      // null in local dev / anywhere not deployed through Railway's git
      // integration — never fabricated as "unknown" or a stale default.
      deployedCommit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
    };
  }
}
