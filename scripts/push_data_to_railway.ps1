<#
  Lean copy of the data the live site shows, from the local Docker Postgres to the
  hosted Railway Postgres. Skips price history, logs and all personal tables.

  Usage (your own terminal; the URL never goes in chat or in a file):
    $env:CHOSN_RAILWAY_DB = '<paste DATABASE_PUBLIC_URL from Railway: Postgres > Variables>'
    .\scripts\push_data_to_railway.ps1            # dry run: shows counts only
    .\scripts\push_data_to_railway.ps1 -Go        # does the copy

  Refuses to run if the hosted database already holds sneakers (use -Force to replace).
  Copies from the local DB; changes nothing locally.
#>
param([switch]$Go, [switch]$Force)
$ErrorActionPreference = 'Stop'
$url = $env:CHOSN_RAILWAY_DB
if (-not $url) { throw 'Set $env:CHOSN_RAILWAY_DB first (Railway: Postgres > Variables > DATABASE_PUBLIC_URL).' }
if ($url -match 'localhost|127\.0\.0\.1|postgres:5432') { throw 'That URL looks local. Use the Railway public URL.' }
$local = 'chosn-postgres-1'; $ldb = 'chosn_dev'
function Remote([string]$sql) { docker exec -i $local psql $url -At -v ON_ERROR_STOP=1 -c $sql }

$have = [int](Remote 'select count(*) from sneakers')
"Hosted sneakers now: $have"
if ($have -gt 0 -and -not $Force) { throw 'Hosted database already has sneakers. Re-run with -Force only if you want them replaced.' }

# order matters for foreign keys; the last entry is the filtered price query
$tables = @(
  @{ t='retailers';                 q='select * from retailers' },
  @{ t='fx_rates';                  q='select * from fx_rates' },
  @{ t='sneakers';                  q='select * from sneakers' },
  @{ t='sneaker_variants';          q='select * from sneaker_variants' },
  @{ t='retailer_product_mappings'; q='select * from retailer_product_mappings' },
  @{ t='retailer_product_ratings';  q='select * from retailer_product_ratings' },
  @{ t='listing_first_seen';        q='select * from listing_first_seen' },
  @{ t='drop_events';               q='select * from drop_events' },
  @{ t='news_items';                q='select * from news_items' },
  @{ t='magazine_issues';           q='select * from magazine_issues' },
  @{ t='brand_watch_products';      q='select * from brand_watch_products' },
  @{ t='price_outlook_priors';      q='select * from price_outlook_priors' },
  @{ t='price_snapshots';           q="select * from price_snapshots where is_latest and listing_url not like '%FIXTURE%'" }
)
foreach ($x in $tables) {
  $n = [int](docker exec $local psql -U postgres -d $ldb -At -c "select count(*) from ($($x.q)) s")
  "{0,-28} {1,9} rows" -f $x.t, $n
}
if (-not $Go) { 'Dry run only. Add -Go to copy.'; return }

# empty the hosted copies of these tables (it is empty or you passed -Force)
$names = ($tables | ForEach-Object { $_.t }) -join ', '
Remote "truncate $names restart identity cascade" | Out-Null

foreach ($x in $tables) {
  "copying $($x.t) ..."
  # byte-safe pipe through cmd so text is not re-encoded
  $copy = "\copy $($x.t) from stdin"
  cmd /c "docker exec $local psql -U postgres -d $ldb -c ""\copy ($($x.q)) to stdout"" | docker exec -i $local psql ""$url"" -v ON_ERROR_STOP=1 -c ""SET session_replication_role = replica"" -c ""$copy"""
  if ($LASTEXITCODE -ne 0) { throw "copy of $($x.t) failed" }
}

'resetting id counters ...'
Remote @'
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.table_name, c.column_name, pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) AS seq
           FROM information_schema.columns c
           WHERE c.table_schema='public' AND pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) IS NOT NULL
  LOOP
    EXECUTE format('SELECT setval(%L, COALESCE((SELECT max(%I) FROM %I), 1))', r.seq, r.column_name, r.table_name);
  END LOOP;
END $$;
'@ | Out-Null
'refreshing summary tables ...'
foreach ($mv in 'catalog_default_variant_mv','catalog_stats_mv','catalog_colors_mv') { Remote "refresh materialized view $mv" | Out-Null }
"Hosted sneakers now: " + (Remote 'select count(*) from sneakers')
'DONE. Check https://chosnapi-production.up.railway.app/catalog/search?limit=3'
