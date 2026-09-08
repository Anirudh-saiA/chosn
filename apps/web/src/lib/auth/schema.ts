/**
 * Auth.js's required table shape, hand-kept in sync with
 * apps/api/src/db/schema.ts's users/accounts/sessions/verificationTokens
 * (and apps/api/drizzle/0008_auth.sql, the actual DDL) — same
 * duplication convention already established for the API/frontend
 * boundary (see lib/catalog.ts's own header comment: "there is no
 * shared types package... hand-kept in sync"). This file exists because
 * apps/web is a second direct database client for exactly these four
 * tables — see lib/auth/db.ts for why that's the right call here
 * specifically, unlike every other table in this database, which
 * apps/web only ever reads through apps/api's REST endpoints.
 */
import { relations } from 'drizzle-orm';
import { index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // totpEnabled and totp_secret_encrypted are read/written via raw SQL
  // in lib/auth/totp.ts, not through this typed table — same reasoning
  // as the API-side schema.ts omitting the encrypted column.
});

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    // Snake_case JS property names below, not this file's usual
    // camelCase — @auth/drizzle-adapter's PostgresDrizzleAdapter reads
    // these OAuth token fields by these exact literal names
    // (`account.refresh_token`, not `account.refreshToken`), confirmed
    // by reading its own .d.ts before writing this rather than
    // guessing and finding out at runtime. userId above stays camelCase
    // because that's what the adapter's own type expects for it — the
    // inconsistency is Auth.js's contract, not a choice made here.
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({
    providerAccountUniq: uniqueIndex('accounts_provider_account_unique').on(t.provider, t.providerAccountId),
    userIdx: index('accounts_user_idx').on(t.userId),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    sessionToken: text('session_token').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
  }),
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));
