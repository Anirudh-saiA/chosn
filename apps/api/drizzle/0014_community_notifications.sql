-- Day 24: community activity notifications (reply/mention), a
-- community-specific opt-in/opt-out, and the schema change needed for
-- system-filed (not human-filed) reports. See
-- apps/api/src/db/schema.ts's own header comment on this section and
-- docs/community/README.md's Day 24 writeup for the full reasoning.

ALTER TABLE users ADD COLUMN notify_on_community_activity boolean NOT NULL DEFAULT true;

-- System-filed reports (VotesService's vote-manipulation guard) have no
-- human reporter — a null here means exactly that, not a data gap.
ALTER TABLE reports ALTER COLUMN reporter_user_id DROP NOT NULL;

CREATE TYPE community_notification_type AS ENUM ('reply', 'mention');

CREATE TABLE community_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type community_notification_type NOT NULL,
  entity_type votable_type NOT NULL,
  entity_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  preview text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX community_notifications_recipient_idx ON community_notifications (recipient_user_id, created_at DESC);
CREATE INDEX community_notifications_unread_idx ON community_notifications (recipient_user_id) WHERE read_at IS NULL;
