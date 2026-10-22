-- Waitlist email drip: name, the shoes someone is tracking, and the
-- bookkeeping a two-mail sequence needs.
--
-- welcome_sent_at / followup_sent_at are the source of truth for "has this
-- mail gone out" — the scheduler claims rows by these columns, so a restart
-- or a second API instance can never double-send. unsubscribe_token is
-- unguessable and per-row so the unsubscribe link works without a login.

ALTER TABLE waitlist_entries
  ADD COLUMN name text,
  ADD COLUMN tracked_shoes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN welcome_sent_at timestamptz,
  ADD COLUMN followup_sent_at timestamptz,
  ADD COLUMN unsubscribed_at timestamptz;

CREATE UNIQUE INDEX waitlist_entries_unsubscribe_token_idx ON waitlist_entries (unsubscribe_token);

-- Entries that existed before this migration already got the old
-- confirmation mail; don't send them a "welcome" now.
UPDATE waitlist_entries
   SET welcome_sent_at = joined_at,
       followup_sent_at = joined_at;

CREATE INDEX waitlist_entries_followup_due_idx
  ON waitlist_entries (joined_at)
  WHERE followup_sent_at IS NULL AND unsubscribed_at IS NULL;
