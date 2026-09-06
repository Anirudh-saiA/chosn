import type { Config } from 'drizzle-kit';

/**
 * drizzle-kit is used for introspection and `studio`, not for generating
 * migrations — the SQL in drizzle/ is hand-authored because it contains
 * a partitioned table and a plpgsql function, neither of which the schema
 * DSL can express. See src/db/migrate.ts.
 */
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
} satisfies Config;
