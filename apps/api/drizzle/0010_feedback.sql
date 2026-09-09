-- Day 19 task 8: soft-launch feedback capture.
--
-- Its own table rather than a PostHog event, for two reasons that both
-- matter during a soft launch:
--
--   1. Submitting feedback is the user's own deliberate action, not
--      tracking. Routing it through PostHog would mean it silently
--      fails for anyone who declined analytics consent (Day 19 task 4)
--      — i.e. exactly the more privacy-conscious users whose feedback
--      is worth having.
--   2. Free-text answers to three specific questions are something you
--      want to sit and read in full, in order, not query out of an
--      analytics event stream.
--
-- user_id is nullable and ON DELETE SET NULL: feedback should survive
-- the author deleting their account (the observation stays useful, the
-- link to a person doesn't), and signed-out visitors can submit too.

CREATE TYPE feedback_topic AS ENUM ('price_trust', 'design_feel', 'positioning', 'other');

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Optional: lets someone signed out leave a way to be replied to,
  -- without requiring it. Never used for marketing.
  contact_email text,
  topic feedback_topic NOT NULL DEFAULT 'other',
  message text NOT NULL,
  -- Which page they were on when they opened the form — the single
  -- most useful piece of context for "this confused me" reports.
  source_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feedback_created_idx ON feedback (created_at DESC);
CREATE INDEX feedback_topic_idx ON feedback (topic);
