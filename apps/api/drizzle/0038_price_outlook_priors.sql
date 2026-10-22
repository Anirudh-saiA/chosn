-- Base rates behind the "Buy now / Wait" outlook: how often comparable shoes (same brand, same price band) got at least 5% cheaper over the
-- recent past, measured from daily_best_prices by scripts/compute-outlook-priors.ts after each import. brand '*' / band '*' is everything.
CREATE TABLE IF NOT EXISTS price_outlook_priors (
  brand text NOT NULL,
  band text NOT NULL,
  n integer NOT NULL,
  drop_share real NOT NULL,
  window_days smallint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand, band)
);
