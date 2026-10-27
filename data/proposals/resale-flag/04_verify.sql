-- Read-only check, any time: rows per store and price_type, and the newest row of each.
SELECT r.slug, s.price_type, count(*) AS rows, max(s.fetched_at) AS newest
FROM price_snapshots s JOIN retailers r ON r.id = s.retailer_id
GROUP BY 1, 2 ORDER BY 1, 2;
