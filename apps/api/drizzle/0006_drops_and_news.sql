-- Feature 3 (Phase 3): instant launch news/drops. Day 12 locks this
-- schema before Day 13 writes a single line of the scheduler/pub-sub
-- pipeline that reads and writes it — same discipline as Day 1.
--
-- One new thing this feature needs that nothing before it did: an
-- identity to notify. CHOSN has no accounts/auth system yet — the only
-- existing "person" record is waitlist_entries (Day 5), which is a
-- one-way capture form, not a login. Rather than block a notifications
-- feature on building full auth (real scope creep for Phase 3), this
-- introduces `subscribers`: a bare identity anchor (id + optional email),
-- not an account system — no password, no session, no login. A visitor
-- gets a subscriber row the moment they enable web push or type an email
-- into a "notify me" control, the same low-friction shape as the
-- waitlist form already uses. When real user accounts exist later,
-- subscriber_id is a straightforward migration target for user_id; until
-- then this is the honest shape of what the product actually has.
-- Flagged explicitly for sign-off in drops/README.md.

DO $$ BEGIN
  CREATE TYPE drop_status AS ENUM ('upcoming', 'live', 'sold_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Matches the brief's granularity recommendation (§5): per-brand or
-- per-model as the encouraged default, global available but not pushed
-- as the primary choice in the UI (Day 14's call, not this migration's).
DO $$ BEGIN
  CREATE TYPE subscription_scope AS ENUM ('brand', 'model', 'global');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------- drop_events

CREATE TABLE IF NOT EXISTS drop_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sneaker_id     UUID NOT NULL REFERENCES sneakers (id) ON DELETE CASCADE,
  release_date   DATE NOT NULL,
  -- Nullable on purpose: a drop's date is frequently confirmed well
  -- before its exact hour is. NULL means "date confirmed, time TBA" —
  -- a real, displayable state, not missing data.
  release_time   TIME,
  -- IANA zone name, not a fixed offset — a stored offset silently goes
  -- wrong across a DST transition, a zone name never does. Defaults to
  -- the primary market (Day 1 §01); a global drop with per-region times
  -- is out of scope for v1 (see drops/README.md) — one release_date +
  -- release_time pair per DropEvent, regions[] says where it's available,
  -- not when each region's clock reads that time.
  release_timezone  TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  regions        region[] NOT NULL DEFAULT '{}',
  retail_price   NUMERIC(12, 2),
  currency       TEXT NOT NULL DEFAULT 'INR',
  status         drop_status NOT NULL DEFAULT 'upcoming',
  -- Where to try to buy at retail — official retailer links, distinct
  -- from the resale price-comparison offers in price_snapshots. Never
  -- rendered by anything that also renders an affiliate "View Deal"
  -- link without a clear visual/textual distinction (Day 12 task 6).
  -- Shape: [{ "retailer_name": "Nike SNKRS", "url": "...", "region": "india" }, ...]
  -- A JSONB array rather than a join table: this is a handful of links
  -- per drop, always read as a whole with the drop, never queried or
  -- filtered on its own — the same reasoning gallery_image_refs already
  -- uses on sneakers for a small, whole-row-scoped list.
  purchase_links JSONB NOT NULL DEFAULT '[]',
  -- NULL = standard first-come-first-served release. Present = this drop
  -- is raffle/draw-based, which changes Day 14's CTA from "Buy now" to
  -- "Enter raffle". v1 stores raffle *metadata* only (where to register,
  -- when registration closes, which method) — CHOSN links out to the
  -- retailer's own raffle, it never runs entries itself, consistent with
  -- never touching money or inventory. Shape:
  -- { "registration_url": "...", "registration_closes_at": "2026-09-20T12:00:00+05:30", "method": "Nike SNKRS Draw" }
  raffle_info    JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The scheduler/watcher's own query (Day 13): "which upcoming drops are
-- due". Partial index — the table stays small in the only state this
-- query ever filters on.
CREATE INDEX IF NOT EXISTS drop_events_upcoming_idx
  ON drop_events (release_date, release_time)
  WHERE status = 'upcoming';
CREATE INDEX IF NOT EXISTS drop_events_sneaker_idx ON drop_events (sneaker_id);
CREATE INDEX IF NOT EXISTS drop_events_status_idx ON drop_events (status);

-- ----------------------------------------------------------- news_items

CREATE TABLE IF NOT EXISTS news_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  -- Nullable: not all news is drop-specific (a brand policy change, a
  -- retailer's own sale event) — see task 2.
  drop_event_id  UUID REFERENCES drop_events (id) ON DELETE SET NULL,
  published_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Attribution, e.g. "CHOSN editorial" for original write-ups, or the
  -- licensed feed's own name when body is sourced from one — never
  -- silently blended so a reader can't tell which is which.
  source         TEXT NOT NULL,
  -- Set only when body originates from a licensed/aggregated source —
  -- the "link to the original" a licensing agreement typically requires,
  -- and a paper trail for the copyright check in task 6. NULL for
  -- CHOSN's own original editorial.
  source_url     TEXT,
  -- The only thing that should trigger an instant push (task 2 + §5) —
  -- ambient news publishes to the feed quietly, breaking news fans out
  -- through the pub/sub flow in drops/README.md.
  is_breaking    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_items_drop_event_idx ON news_items (drop_event_id);
CREATE INDEX IF NOT EXISTS news_items_published_idx ON news_items (published_at DESC);
CREATE INDEX IF NOT EXISTS news_items_breaking_idx ON news_items (published_at DESC)
  WHERE is_breaking = true;

-- ------------------------------------------------------------ subscribers

CREATE TABLE IF NOT EXISTS subscribers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable: a visitor can enable web push without ever giving an
  -- email, or give an email without enabling push (email-only digest).
  -- Not UNIQUE-with-NOT NULL — a NULL email is normal, not a gap.
  email       TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One subscriber can carry notifications across more than one browser/
-- device; each Web Push API registration is its own endpoint+key pair.
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   UUID NOT NULL REFERENCES subscribers (id) ON DELETE CASCADE,
  -- The push service URL the browser hands back from
  -- PushManager.subscribe() — unique per registration, the natural key.
  endpoint        TEXT NOT NULL UNIQUE,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_push_subscriptions_subscriber_idx
  ON web_push_subscriptions (subscriber_id);

-- ------------------------------------------------------ notification_subscriptions

CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id  UUID NOT NULL REFERENCES subscribers (id) ON DELETE CASCADE,
  scope_type     subscription_scope NOT NULL,
  -- Brand name ('Nike') or style_code ('DD1391-100') depending on
  -- scope_type; NULL when scope_type = 'global'. Not FK'd to sneakers —
  -- a brand-scope subscription has no single sneaker row to point at,
  -- and a model-scope one predates the specific colorway sometimes
  -- existing yet (a subscriber can follow a silhouette before CHOSN has
  -- catalogued this season's colorway of it).
  scope_value    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_subscriptions_scope_value_check
    CHECK (
      (scope_type = 'global' AND scope_value IS NULL)
      OR (scope_type <> 'global' AND scope_value IS NOT NULL)
    )
);

-- Prevents the same subscriber double-subscribing to the same thing.
-- A plain UNIQUE(subscriber_id, scope_type, scope_value) wouldn't catch
-- duplicate 'global' rows — NULL <> NULL in a standard unique
-- constraint — so this expression-indexes the NULL case to a stand-in.
CREATE UNIQUE INDEX IF NOT EXISTS notification_subscriptions_unique
  ON notification_subscriptions (subscriber_id, scope_type, COALESCE(scope_value, ''));

-- The watcher's fan-out query (Day 13): "who follows this brand/model,
-- plus everyone global".
CREATE INDEX IF NOT EXISTS notification_subscriptions_scope_idx
  ON notification_subscriptions (scope_type, scope_value);
