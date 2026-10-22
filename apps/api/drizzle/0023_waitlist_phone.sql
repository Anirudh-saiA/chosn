-- Optional phone number on a waitlist signup (name and email are already collected). Stored as typed, trimmed.
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS phone text;
