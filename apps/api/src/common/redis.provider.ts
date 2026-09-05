import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider = {
  provide: REDIS_CLIENT,
  // Falls back to the local docker-compose Redis rather than throwing
  // at boot if REDIS_URL is unset — matches the default already in
  // apps/api/.env.example. RateLimitGuard fails open on a real
  // connection error either way (see rate-limit.guard.ts).
  useFactory: () =>
    new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380', {
      maxRetriesPerRequest: 1, // fail fast — RateLimitGuard fails open on error
    }),
};
