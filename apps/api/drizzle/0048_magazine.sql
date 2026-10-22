-- The CHOSN Times: one row per issue (a daily or a weekly), the pages stored as JSON so an issue never changes after it is printed.
CREATE TABLE IF NOT EXISTS magazine_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('daily', 'weekly')),
  issue_no integer NOT NULL,
  title text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  pages jsonb NOT NULL,
  pdf_file text,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, issue_no)
);
CREATE INDEX IF NOT EXISTS magazine_issues_kind_idx ON magazine_issues (kind, published_at DESC);
