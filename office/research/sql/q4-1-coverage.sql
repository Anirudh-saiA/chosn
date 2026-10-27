-- SELECT-only. Run: docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' chosn-postgres-1 psql -U postgres -d chosn_dev -X < this-file
-- Coverage of latest INR prices (last 4 days) by retailer. Group labels are R&D's, not in the database (see the research note).
with l as (
 select sn.style_code, sn.brand, v.size, r.slug, s.price, sn.retail_price mrp
 from price_snapshots s join retailers r on r.id=s.retailer_id
 join sneaker_variants v on v.id=s.sneaker_variant_id join sneakers sn on sn.id=v.sneaker_id
 where s.is_latest and s.currency='INR' and s.price>0 and s.fetched_at>now()-interval '4 days')
select slug, count(*) rows, count(distinct style_code) styles, round(percentile_cont(.5) within group (order by price)) med_price, count(*) filter (where mrp is not null) rows_with_mrp
from l group by 1 order by 1;
