-- Myntra and Puma India are read once a week (they are the two slow stores), so a price from the last weekly run is
-- still current for 7 days. "Best available" ignores a price older than twice the store's fetch cadence; at the old
-- 720-minute value their prices would have dropped out of every comparison after one day.
UPDATE retailers SET fetch_frequency_minutes = 10080 WHERE slug IN ('myntra', 'puma-india');
