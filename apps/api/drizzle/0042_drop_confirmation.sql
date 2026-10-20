-- How firmly a drop's date is known, shown as a badge so nobody mistakes a lead for a confirmed date:
--   confirmed   a brand or retailer's own page states it
--   reported    two or more release trackers agree, no official page checked yet
--   unconfirmed a single source, or sources disagree
-- Existing rows stay 'confirmed' (they were entered as such); the importer sets the right level for new ones.
ALTER TABLE drop_events ADD COLUMN IF NOT EXISTS confirmation text NOT NULL DEFAULT 'confirmed';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drop_events_confirmation_chk') THEN
    ALTER TABLE drop_events ADD CONSTRAINT drop_events_confirmation_chk CHECK (confirmation IN ('confirmed', 'reported', 'unconfirmed'));
  END IF;
END $$;
