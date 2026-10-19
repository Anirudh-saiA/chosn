-- Each store's Trust score (0-100), how confident it is, and the working behind it (scripts/trust/compute_trust.py). The formula and every
-- source live in that script and in scripts/trust/curated.json; trust_detail keeps the parts, the reasons and the sources shown on the site.
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS trust_score integer;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS trust_confidence text;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS trust_detail jsonb;
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS trust_updated_at timestamptz;
