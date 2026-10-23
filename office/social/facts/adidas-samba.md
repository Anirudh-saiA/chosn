# adidas Samba OG
slug: adidas-samba
db: adidas|SAMBA OG
checked: 2026-10-23

## What the brand says (R&D, read 2026-10-23)
- India MRP on adidas.co.in: men Rs 10,999 (B75807 and most), Rs 11,999 on some; women Rs 10,999 to Rs 13,999; kids Rs 5,999 to Rs 6,999. Some pairs show a sale price (for example Rs 7,199.50 on an Rs 11,999 pair). Confirmed.
- B75807: "soft leather upper, suede overlays and gum sole". Confirmed (adidas India). Origin not shown on the page text read.
- DATA NOTE: our database stores Rs 9,350 as the retail price of B75807; adidas India shows Rs 10,999. The Data team should check how `sneakers.retail_price` is filled. Do not quote the database field.
- Standard pairs: a reseller lists some women's Sambas as made in Vietnam and others in China. Unverified, single source.
- Our scrape 2026-10-21/22: about Rs 6,049 (Myntra) to Rs 13,999; Superkicks and VegNonVeg mostly Rs 10,999.

## Sources
- https://www.adidas.co.in/samba-og-shoes/B75807.html (MRP, materials)
- https://www.adidas.co.in/samba (MRP range)
- https://www.footlocker.com/product/~/JI3214.html and https://www.lyst.co.uk/shoes/adidas-samba-og-375/ (retailer descriptions; Reported)
- https://coverchord.com/en/products/vadw-f4104 (origin, unverified)

## Not verified
Factory for India stock; whether other colourways use a different upper.

## Posts
@post samba-price | Confirmed
text: Samba OG B75807, per adidas India: soft leather upper, suede overlays, gum sole, MRP ₹10,999. The same model in our Indian store scrape runs from ₹{min} to ₹{max}. Colourways and sellers differ, so check the style code first. What did you pay?
sources: https://www.adidas.co.in/samba-og-shoes/B75807.html ; https://www.adidas.co.in/samba

@question samba-q
text: Samba OG is ₹{min} at one store and ₹{max} at another in our data, and adidas India's MRP is ₹10,999. Do you compare stores before buying, or buy where you trust the seller?
