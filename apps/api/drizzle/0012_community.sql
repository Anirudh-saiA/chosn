-- Day 21/22: structured community posts (Price Check, Cop or Drop,
-- Legit Check, Drop Talk), comments/votes, and per-drop live chat rooms.
--
-- One `posts` table for all four types, not one table per type — see
-- apps/api/src/db/schema.ts's own header comment on this section for
-- the reasoning, and docs/community/README.md for the full writeup
-- including the chat moderation latency tradeoff this migration's
-- chat_messages.classifier_status column implements.

-- --------------------------------------------------------------- posts

CREATE TYPE post_type AS ENUM ('price_check', 'cop_or_drop', 'legit_check', 'drop_talk');

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_type post_type NOT NULL,
  title text,
  body text,
  sneaker_variant_id uuid REFERENCES sneaker_variants(id) ON DELETE SET NULL,
  drop_event_id uuid REFERENCES drop_events(id) ON DELETE SET NULL,
  -- legit_check only: the community-verification checklist as
  -- {id, label}[] — configurable per post, not a hardcoded enum, since
  -- a Dunk's authentication checklist isn't a Yeezy's.
  legit_check_checklist jsonb,
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Catches "used the wrong post type's shape" at write time: legit_check
  -- always carries a checklist, nothing else ever does.
  CONSTRAINT posts_legit_check_checklist_shape CHECK (
    (post_type = 'legit_check' AND legit_check_checklist IS NOT NULL)
    OR (post_type <> 'legit_check' AND legit_check_checklist IS NULL)
  )
);

CREATE INDEX posts_type_idx ON posts (post_type, created_at DESC);
CREATE INDEX posts_author_idx ON posts (author_user_id);
CREATE INDEX posts_drop_event_idx ON posts (drop_event_id);

-- ---------------------------------------------------------- post_images

CREATE TYPE classifier_status AS ENUM ('pending', 'clean', 'flagged');

CREATE TABLE post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  -- Which legit_check_checklist item this photo answers (the checklist
  -- item's own `id`, not a FK — the checklist is JSON, not a table).
  checklist_item_id text,
  -- Local disk path under /uploads — see UploadsModule's own comment on
  -- why (no cloud storage configured for local dev).
  url text NOT NULL,
  classifier_status classifier_status NOT NULL DEFAULT 'pending',
  classifier_score numeric(4, 3),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX post_images_post_idx ON post_images (post_id);

-- -------------------------------------------------------------- comments

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comments_post_idx ON comments (post_id, created_at);

-- ---------------------------------------------------------------- votes

CREATE TYPE votable_type AS ENUM ('post', 'comment');

CREATE TABLE votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  votable_type votable_type NOT NULL,
  votable_id uuid NOT NULL,
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT votes_value_check CHECK (value IN (1, -1))
);

-- One vote per user per thing — casting again updates the existing row.
CREATE UNIQUE INDEX votes_one_per_user ON votes (user_id, votable_type, votable_id);
CREATE INDEX votes_votable_idx ON votes (votable_type, votable_id);

-- ------------------------------------------------------------ poll_votes

-- Cop or Drop's own table, not a reuse of `votes` — a poll choice isn't
-- a +1/-1 score, it's a two-option pick with its own live percentage-bar
-- display. Explicit per the brief.
CREATE TYPE poll_choice AS ENUM ('cop', 'drop');

CREATE TABLE poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice poll_choice NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX poll_votes_one_per_user ON poll_votes (post_id, user_id);

-- ------------------------------------------------------------ chat_rooms

CREATE TYPE chat_room_status AS ENUM ('scheduled', 'open', 'archived');

CREATE TABLE chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_event_id uuid NOT NULL REFERENCES drop_events(id) ON DELETE CASCADE,
  status chat_room_status NOT NULL DEFAULT 'scheduled',
  -- release_time minus 1h — when the scheduler should flip this to 'open'.
  opens_at timestamptz NOT NULL,
  -- Set once opened (opened time + 24h) — when the scheduler should flip
  -- this to 'archived'. NULL until then.
  archives_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX chat_rooms_drop_event_unique ON chat_rooms (drop_event_id);
CREATE INDEX chat_rooms_status_idx ON chat_rooms (status);

-- --------------------------------------------------------- chat_messages

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  -- Broadcast-then-review (flagged decision — see
  -- docs/community/README.md): ships to every connected client the
  -- instant it's sent; classifier_status starts 'pending' and updates
  -- async. A message that resolves 'flagged' gets retracted after the
  -- fact (task 7), never held back before broadcast.
  classifier_status classifier_status NOT NULL DEFAULT 'pending',
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_room_idx ON chat_messages (room_id, created_at);
