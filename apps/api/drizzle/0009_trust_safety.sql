-- Day 17: trust & safety foundation — reporting, blocking, anonymity
-- controls, and the admin role reporting/moderation needs.
--
-- Built ahead of any actual community/UGC feature (see
-- docs/trust-and-safety/README.md) specifically so the safety layer
-- isn't retrofitted after user-to-user interaction already exists.

-- ---------------------------------------------------------------- users

-- role, not is_admin: a boolean only ever answers "admin or not," and
-- the day this needs a 'moderator' tier that can review reports but not
-- everything an admin can, a boolean forces a second column anyway.
-- One enum column now costs nothing and already has the room. Flagged
-- as an assumption in docs/trust-and-safety/README.md — a plain
-- is_admin boolean is the simpler alternative if that extensibility
-- never ends up mattering.
CREATE TYPE user_role AS ENUM ('user', 'admin');

ALTER TABLE users
  ADD COLUMN role user_role NOT NULL DEFAULT 'user',
  -- Separate from name/email on purpose (task 3) — name is what a real
  -- person is called and email is a login credential; display_name is
  -- the only one of the three this app should ever put in front of
  -- another user once a community surface exists. NULL falls back to a
  -- generated placeholder ("Collector 4f2a") at render time, not here —
  -- keeping NULL meaningful (never set) distinct from an actual chosen
  -- name avoids baking a fallback string into the row itself.
  ADD COLUMN display_name text,
  -- Seeds a deterministic, generated identicon (apps/web's
  -- AvatarIdenticon component) — never a photo upload. Defaults to the
  -- user's own id so every account has a stable avatar from creation
  -- with no extra write; changing it (the security page's "New avatar"
  -- action) is just picking a new random seed, nothing to store as a
  -- file or moderate as an image.
  ADD COLUMN avatar_seed text NOT NULL DEFAULT gen_random_uuid()::text;

-- -------------------------------------------------------------- reports

-- Extend this list as community features ship (task 1) — post/comment/
-- message don't exist as real tables yet, so reported_entity_id is
-- intentionally not a foreign key to any of them. A report must still
-- be filable (and auditable) against content whose owning table may
-- later be dropped, renamed, or split, and a report is evidence of what
-- was reported, not a live join to it — same append-only-evidence
-- reasoning as price_snapshots and manual_price_entries elsewhere in
-- this schema.
CREATE TYPE report_entity_type AS ENUM ('user', 'post', 'comment', 'message');

CREATE TYPE report_reason AS ENUM (
  'harassment',
  'doxxing',
  'scam',
  'hate_speech',
  'spam',
  'other'
);

CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'actioned', 'dismissed');

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_entity_type report_entity_type NOT NULL,
  reported_entity_id uuid NOT NULL,
  reason report_reason NOT NULL,
  details text,
  status report_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  -- The admin's own note on the action taken — task 5 ("action-taken
  -- with a note"). Distinct from `details`, which is the reporter's own
  -- account of what happened.
  review_note text,
  -- Deliberately does NOT require reviewed_by IS NOT NULL for a
  -- reviewed row — only reviewed_at, which has no FK and can't change
  -- out from under a row. reviewed_by references users(id) ON DELETE
  -- SET NULL: if the admin who reviewed something later has their own
  -- account deleted, that FK correctly nulls reviewed_by on every
  -- report they touched. A constraint requiring reviewed_by IS NOT
  -- NULL on every non-pending row would then make deleting that admin
  -- account impossible — found by actually deleting a test admin
  -- during this migration's own verification, not reasoned about after
  -- the fact. The application layer (ReportsService.review) still
  -- always sets both fields together at the moment of review; this
  -- constraint just doesn't retroactively re-demand reviewed_by once a
  -- legitimate cascade has cleared it.
  CONSTRAINT reports_review_consistency CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status <> 'pending' AND reviewed_at IS NOT NULL)
  )
);

-- The moderation queue's own default view: "what's still pending,
-- oldest first" — every other status is the minority once a report's
-- been through the queue.
CREATE INDEX reports_pending_idx ON reports (created_at)
  WHERE status = 'pending';
CREATE INDEX reports_entity_idx ON reports (reported_entity_type, reported_entity_id);
CREATE INDEX reports_reporter_idx ON reports (reporter_user_id);

-- --------------------------------------------------------------- blocks

CREATE TABLE user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_blocks_not_self CHECK (blocker_user_id <> blocked_user_id)
);

-- One block per pair — re-blocking is a no-op, not a duplicate row.
CREATE UNIQUE INDEX user_blocks_pair_unique ON user_blocks (blocker_user_id, blocked_user_id);
-- The enforcement-side lookup ("does anyone block me / do I block
-- them") needs both directions fast — see
-- docs/trust-and-safety/README.md's enforcement contract.
CREATE INDEX user_blocks_blocked_idx ON user_blocks (blocked_user_id);
