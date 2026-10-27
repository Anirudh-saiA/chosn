#!/bin/bash
# Undo: restore the old price_type of every row in the backup file (default: the newest backup_price_type_*.csv here).
# Rows the importer wrote after step 2 (new resale snapshots) are not in the backup and stay 'resale', which is correct.
set -e
cd "$(dirname "$0")"
BK="${1:-$(ls -1 backup_price_type_*.csv | tail -1)}"
echo "restoring from $BK"
docker cp "$BK" chosn-postgres-1:/tmp/price_type_backup.csv
docker exec -i chosn-postgres-1 psql -U postgres -d chosn_dev -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
CREATE TEMP TABLE b (id uuid, fetched_at timestamptz, price_type price_type, slug text);
\copy b FROM '/tmp/price_type_backup.csv' WITH (FORMAT csv, HEADER)
SELECT count(*) AS rows_in_backup FROM b;
UPDATE price_snapshots s SET price_type = b.price_type FROM b WHERE s.id = b.id AND s.fetched_at = b.fetched_at;
COMMIT;
SELECT r.slug, s.price_type, count(*) FROM price_snapshots s JOIN retailers r ON r.id = s.retailer_id
  WHERE r.slug IN ('mainstreet-marketplace','culture-circle') GROUP BY 1, 2 ORDER BY 1, 2;
SQL
docker exec chosn-postgres-1 rm -f /tmp/price_type_backup.csv
