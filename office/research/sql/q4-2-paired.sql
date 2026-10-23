-- SELECT-only. Same style code AND same size: marketplace listing vs the cheapest in-stock-or-not store listing (latest, last 4 days, INR).
-- Groups (R&D assumption, to be sourced in the note): mkt = mainstreet-marketplace, culture-circle; store = superkicks, vegnonveg, myntra, ajio, flipkart, puma-india, limited-edt
with l as (
 select sn.style_code, sn.brand, v.size, v.size_system, v.region, r.slug, s.price, s.in_stock, sn.retail_price mrp,
  case when r.slug in ('mainstreet-marketplace','culture-circle') then 'mkt'
       when r.slug in ('superkicks','vegnonveg','myntra','ajio','flipkart','puma-india','limited-edt') then 'store' end grp
 from price_snapshots s join retailers r on r.id=s.retailer_id
 join sneaker_variants v on v.id=s.sneaker_variant_id join sneakers sn on sn.id=v.sneaker_id
 where s.is_latest and s.currency='INR' and s.price>0 and s.fetched_at>now()-interval '4 days'),
m as (select style_code, brand, size, size_system, region, slug, price from l where grp='mkt'),
t as (select style_code, size, size_system, region, min(price) store_min from l where grp='store' group by 1,2,3,4),
j as (select m.*, t.store_min, m.price/t.store_min ratio from m join t using (style_code,size,size_system,region))
select slug, count(*) pairs, count(distinct style_code) styles,
 round(percentile_cont(.1) within group (order by ratio)::numeric,2) p10,
 round(percentile_cont(.5) within group (order by ratio)::numeric,2) median_ratio,
 round(percentile_cont(.9) within group (order by ratio)::numeric,2) p90,
 round(100.0*count(*) filter (where ratio<1)/count(*)) pct_cheaper_than_store,
 round(100.0*count(*) filter (where ratio between .8 and 1.25)/count(*)) pct_within_pm20
from j group by 1;
