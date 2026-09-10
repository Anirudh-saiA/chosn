-- Day 23: reputation v1 — see apps/api/src/db/schema.ts's own header
-- comment on this section, docs/community/README.md's Day 23 writeup,
-- and ReputationService's own doc comment for the formula and the one
-- gated action (Legit Check post creation) it powers. Both are flagged
-- as override-able assumptions, not settled defaults.

CREATE TABLE user_reputation (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  -- Placeholder — always 0 today, no real purchase-verification signal
  -- wired up yet. The column and its weight exist so activating it later
  -- is a body-only change in ReputationService, not a schema migration.
  verified_purchase_count integer NOT NULL DEFAULT 0,
  -- Sum of max(0, netVotes) across every post/comment this user authored.
  helpful_votes_received integer NOT NULL DEFAULT 0,
  account_created_at timestamptz NOT NULL,
  last_calculated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill: one row per existing user, scored from what's already true
-- today (account age; helpful_votes_received starts at 0 and catches up
-- on the next scheduled recalculation or the next vote on their content).
INSERT INTO user_reputation (user_id, score, account_created_at, last_calculated_at)
SELECT id, LEAST(EXTRACT(DAY FROM now() - created_at)::int, 60), created_at, now()
FROM users;
