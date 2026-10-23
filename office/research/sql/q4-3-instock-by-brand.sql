-- SELECT-only. As q4-2 but both sides in stock, split by brand, mainstreet+culture-circle pooled; plus how often the store price equals/exceeds the sneakers.retail_price (MRP) where we have one.
with l as (
 select sn.style_code, sn.brand, v.size, v.size_system, v.region, r.slug, s.price, s.in_stock, sn.retail_price mrp,
  case when r.slug in ('mainstreet-marketplace','culture-circle') then 'mkt'
       when r.slug in ('superkicks','vegnonveg','myntra','ajio','flipkart','puma-india','limited-edt') then 'store' end grp
 from price_snapshots s join retailers r on r.id=s.retailer_id
 join sneaker_variants v on v.id=s.sneaker_variant_id join sneakers sn on sn.id=v.sneaker_id
 where s.is_latest and s.in_stock and s.currency='INR' and s.price>0 and s.fetched_at>now()-interval '4 days'),
m as (select style_code, brand, size, size_system, region, min(price) mkt_min from l where grp='mkt' group by 1,2,3,4,5),
t as (select style_code, size, size_system, region, min(price) store_min from l where grp='store' group by 1,2,3,4),
j as (select m.*, t.store_min, m.mkt_min/t.store_min ratio from m join t using (style_code,size,size_system,region))
select brand, count(*) pairs, count(distinct style_code) styles,
 round(percentile_cont(.5) within group (order by ratio)::numeric,2) median_ratio,
 round(100.0*count(*) filter (where ratio<1)/count(*)) pct_mkt_cheaper,
 round(100.0*count(*) filter (where ratio between .8 and 1.25)/count(*)) pct_within_pm20,
 round(100.0*count(*) filter (where ratio>2)/count(*)) pct_over_2x
from j group by rollup(brand) having count(*)>=30 order by pairs desc;
