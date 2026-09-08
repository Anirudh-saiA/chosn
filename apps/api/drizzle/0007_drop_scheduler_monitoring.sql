-- Day 13: scheduler run history + per-consumer failure counts (task 7's
-- monitoring ask, same pattern as fetch_failures/FetchHealthService from
-- Day 7 — a durable Postgres table, not BullMQ's own job history, since
-- Redis is a cache this project is willing to lose and BullMQ trims old
-- jobs). Also a DB-level guard against a duplicate auto-post.
--
-- That guard matters for a reason worth spelling out: the scheduler's
-- "flip status" step IS exactly-once across replicas (an
-- UPDATE ... WHERE status = 'upcoming' is a single atomic statement, and
-- BullMQ's upsertJobScheduler is itself distributed via Redis, so N API
-- instances converge on one recurring job, not N). The news-feed
-- consumer is not: Redis Pub/Sub fans a published message out to every
-- subscriber connected to the channel, not to one of them — if this API
-- ever runs more than one instance, every instance's
-- DropNewsAutoPostService independently receives the same drop:live
-- event and would otherwise independently insert a NewsItem. Today this
-- is a single Railway instance, so it can't actually happen yet, but the
-- unique index below makes the auto-post idempotent regardless of
-- instance count, at zero cost, rather than depending on staying
-- single-instance forever.

CREATE TABLE IF NOT EXISTS drop_scheduler_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Rows actually flipped by this run's UPDATE ... RETURNING — the same
  -- number answers both "did it run" (a row exists) and "did it find
  -- anything to flip" (this count), with no separate pre-check query
  -- that could race against the UPDATE and report a different number.
  flipped      INTEGER NOT NULL,
  duration_ms  INTEGER NOT NULL,
  -- Set only when the tick's own query failed outright (DB unreachable,
  -- etc.) — a normal run with nothing due is flipped = 0, error = NULL,
  -- not an error state.
  error        TEXT
);

CREATE INDEX IF NOT EXISTS drop_scheduler_runs_run_at_idx ON drop_scheduler_runs (run_at DESC);

CREATE TABLE IF NOT EXISTS drop_consumer_failures (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- e.g. 'news-feed-auto-post' — a short slug, not an FK to anything,
  -- since Day 14's WebSocket/push consumers don't have a table of their
  -- own to reference either.
  consumer       TEXT NOT NULL,
  drop_event_id  UUID REFERENCES drop_events (id) ON DELETE CASCADE,
  reason         TEXT NOT NULL,
  failed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drop_consumer_failures_recent_idx
  ON drop_consumer_failures (consumer, failed_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS news_items_auto_post_unique
  ON news_items (drop_event_id)
  WHERE source = 'CHOSN (auto)';
