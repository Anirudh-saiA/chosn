-- SELECT-only. Ten example style codes with the most paired sizes: store min vs marketplace min (in stock), plus our recorded retail_price.
with l as (
 select sn.style_code, sn.brand, sn.model, sn.retail_price mrp, v.size, v.size_system, v.region, r.slug, s.price,
  case when r.slug in ('mainstreet-marketplace','culture-circle') then 'mkt' when r.slug in ('superkicks','vegnonveg','myntra','ajio','flipkart','puma-india','limited-edt') then 'store' end grp
 from price_snapshots s join retailers r on r.id=s.retailer_id join sneaker_variants v on v.id=s.sneaker_variant_id join sneakers sn on sn.id=v.sneaker_id
 where s.is_latest and s.in_stock and s.currency='INR' and s.price>0 and s.fetched_at>now()-interval '4 days'),
a as (select style_code, brand, model, max(mrp) mrp, size, size_system, region,
  min(price) filter (where grp='store') store_min, min(price) filter (where grp='mkt') mkt_min from l group by 1,2,3,5,6,7)
select style_code, brand, model, max(mrp) mrp, count(*) sizes, round(percentile_cont(.5) within group (order by store_min)) store_med, round(percentile_cont(.5) within group (order by mkt_min)) mkt_med
from a where store_min is not null and mkt_min is not null group by 1,2,3 order by count(*) desc limit 12;
