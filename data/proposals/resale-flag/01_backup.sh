#!/bin/bash
# Step 1 (read-only): save every row that step 2 would change: id, fetched_at (the partition key), the old price_type, and the store.
# Output: backup_price_type_<date>.csv in this folder. Check the row count it prints against 02_update.sql's expected count.
set -e
cd "$(dirname "$0")"
OUT="backup_price_type_$(date +%F).csv"
docker exec -e PGOPTIONS='-c default_transaction_read_only=on' chosn-postgres-1 psql -U postgres -d chosn_dev -X -q -c \
  "COPY (SELECT s.id, s.fetched_at, s.price_type, r.slug FROM price_snapshots s JOIN retailers r ON r.id = s.retailer_id
         WHERE r.slug IN ('mainstreet-marketplace','culture-circle') AND s.price_type <> 'resale'
         ORDER BY s.fetched_at, s.id) TO STDOUT WITH (FORMAT csv, HEADER)" > "$OUT"
echo "rows saved (without header): $(( $(wc -l < "$OUT") - 1 )) -> $PWD/$OUT"
