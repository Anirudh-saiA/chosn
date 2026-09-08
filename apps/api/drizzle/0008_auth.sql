-- Day 16: real accounts. Auth.js (NextAuth v5) owns login/session in
-- apps/web via @auth/drizzle-adapter, against this same Postgres
-- database — the adapter's required shape (users/accounts/sessions/
-- verification_token) is standard, but every column here is named in
-- this project's snake_case convention rather than Auth.js's own
-- camelCase example schema, matching every other table in this
-- database. @auth/drizzle-adapter takes an explicit schema mapping, so
-- this doesn't require adopting its naming.
--
-- users.password_hash is nullable — null for an OAuth-only account
-- (Google), set for a credentials (email/password) account. bcrypt
-- hashing itself happens in application code (apps/web, via bcryptjs)
-- — never a hand-rolled hash, but not something a database migration
-- does either.
--
-- Deliberately NOT a rewrite of `subscribers` (Day 12) into `users` —
-- see drops/README.md's Day 16 section for the reasoning. `subscribers`
-- gains a nullable `user_id` link instead: an anonymous notify-me
-- subscription still works with no account, and gets linked to a real
-- account the moment its browser's subscriberId is seen again after a
-- real login.

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT,
  email           TEXT NOT NULL UNIQUE,
  email_verified  TIMESTAMPTZ,
  image           TEXT,
  -- NULL for an OAuth-only account. bcrypt output (never a plain
  -- password, never reversible) — see apps/web/src/lib/auth/password.ts.
  password_hash   TEXT,
  -- TOTP (task 2), opt-in. The secret itself is never stored in the
  -- clear — see totp_secret_encrypted below — this flag is just
  -- "has the user finished enrollment," checked on every login before
  -- a second factor is even asked for.
  totp_enabled    BOOLEAN NOT NULL DEFAULT false,
  -- pgp_sym_encrypt'd with TOTP_ENCRYPTION_KEY (apps/web env), not
  -- plaintext — pgcrypto is already enabled on this database (Day 1).
  -- A stolen database dump alone can't produce working 2FA codes; the
  -- application-side key is also required. Written/read only via raw
  -- SQL (apps/web/src/lib/auth/totp.ts) — Drizzle's typed builder has
  -- no way to call a pgcrypto function inline.
  totp_secret_encrypted  BYTEA,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OAuth provider linkage (Google today, others later without a schema
-- change) — one row per (provider, providerAccountId), a user can link
-- more than one provider to the same account.
CREATE TABLE IF NOT EXISTS accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type                 TEXT NOT NULL,
  provider             TEXT NOT NULL,
  provider_account_id  TEXT NOT NULL,
  refresh_token        TEXT,
  access_token         TEXT,
  expires_at           INTEGER,
  token_type           TEXT,
  scope                TEXT,
  id_token             TEXT,
  session_state        TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider_account_unique
  ON accounts (provider, provider_account_id);
CREATE INDEX IF NOT EXISTS accounts_user_idx ON accounts (user_id);

-- Auth.js's "database" session strategy table — kept for adapter
-- compatibility and as a real revocation point (task 1 asks for
-- refresh-token rotation; a stolen session can be deleted server-side
-- here, which a pure-JWT-only strategy can't do without a denylist).
CREATE TABLE IF NOT EXISTS sessions (
  session_token  TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires        TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Email verification / passwordless-reset tokens.
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier  TEXT NOT NULL,
  token       TEXT NOT NULL,
  expires     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ------------------------------------------------------ linking existing data

-- Day 12's bare `subscribers` identity, now optionally linked to a real
-- account. NULL means "still anonymous" — the existing no-login notify-
-- me flow keeps working exactly as built; this column is populated the
-- moment a subscriber with a matching browser (subscriberId in
-- localStorage) completes a real login, not retroactively guessed.
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS subscribers_user_idx ON subscribers (user_id);

-- Day 5's waitlist signal, reconciled rather than replaced (task 3) —
-- once someone who joined the waitlist creates a real account with the
-- same email, this records the link. Never deleted: "how many waitlist
-- signups actually converted" is a real product metric this makes
-- answerable, which deleting/merging the row would destroy.
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS waitlist_entries_linked_user_idx ON waitlist_entries (linked_user_id);
