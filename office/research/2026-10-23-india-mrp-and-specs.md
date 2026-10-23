# India MRPs and brand-page specs for the ten fact-bank shoes (research tasks 2 and 3)
**Answer / recommendation:** Seven of the ten shoes can move to **Confirmed** for India price from the brand's own India store, and five for materials. The other five need a person or a different route. Three fact-bank lines are now **out of date or contradicted**, listed first below. Quote India prices only with the date and style code, because the brand pages show several prices per shoe by colourway.
**Confidence:** high for the brand pages that loaded (read in a browser on 2026-10-23); low for the five shoes whose brand page could not be read. **What would change it:** a price change on the brand site, or the pair in a customer's hand showing a different tag.

**Labels:** Confirmed = the brand's own page; Reported = a retailer, review or tracker; Unconfirmed = could not verify.

## Fix these in the fact bank first
1. **Nike Dunk Low:** the file says "Nike India MRP seen via search: Rs 8,695 and Rs 11,895". On nike.in today the standard Dunk Low Retro is **₹8,295**, not ₹8,695 (Confirmed, 2026-10-23). The ₹11,895 figure does not appear on the Dunk page.
2. **adidas Campus 00s:** the file says "suede upper, textile lining" as if it applied to all. adidas India's own descriptions differ by style code: HQ8708 is a **premium leather** upper with terry-textile lining; JR8163 is **suede** (Confirmed). The post must name the style code.
3. **adidas Samba OG:** our database stores a retail price of ₹9,350 for B75807. adidas India shows **₹10,999** ("MRP in Indian currency per pair") for B75807 (Confirmed). That database field is stale; the Data team should check how `sneakers.retail_price` is filled.

## India MRPs (brand page, checked 2026-10-23, INR including GST)
| Shoe | MRP on the brand's India page | Status | Source |
|---|---|---|---|
| **Nike Dunk Low** | Dunk Low Retro (men) **₹8,295** (most colourways), ₹9,995 on some; Retro Premium ₹10,795 to ₹10,995; Retro SE ₹10,795; Dunk Low (women) ₹8,295 to ₹9,695; GORE-TEX ₹14,995. Style HF5441-105: ₹8,295. | Confirmed | [nike.in Dunk](https://www.nike.in/dunk/c/94027), [HF5441-105](https://www.nike.in/nike-dunk-low-retro-men-s-shoes/p/24948349) |
| **Nike Air Force 1 '07** | Men ₹7,495, ₹9,695 (style FJ4146-137), ₹11,895 by colourway; LV8 ₹10,995; women ₹8,195 to ₹10,995. First page of 115 results only. | Confirmed | [nike.in AF1](https://www.nike.in/air-force-1/c/94020), [FJ4146-137](https://www.nike.in/nike-air-force-1-07-men-s-shoes/p/29403441) |
| **Air Jordan 1 Low** | Men **₹8,995**; women ₹8,295; kids ₹7,295; SE ₹11,495; OG "Banned" ₹14,995 | Confirmed | [nike.in AJ1](https://www.nike.in/air-jordan-1/c/94019) |
| **adidas Yeezy Boost 350 V2** | Not sold on adidas India: the /yeezy page redirects to the Originals shoes list, and a direct product address returned only an empty page | Unconfirmed (absence) | [adidas.co.in](https://www.adidas.co.in/yeezy) |
| **adidas Samba OG** | Men **₹10,999** (B75807 and most), ₹11,999 on some; women ₹10,999 to ₹13,999; kids ₹5,999 to ₹6,999. Some pairs show a sale price (for example ₹7,199.50 on an ₹11,999 pair). | Confirmed | [adidas.co.in/samba](https://www.adidas.co.in/samba), [B75807](https://www.adidas.co.in/samba-og-shoes/B75807.html) |
| **adidas Campus (00s)** | Men **₹10,999**, with sale prices from ₹7,699.50 down to ₹4,950 on some colourways; kids ₹5,999 to ₹9,999 | Confirmed | [adidas.co.in/campus](https://www.adidas.co.in/campus) |
| **adidas Superstar II** | The Superstar page lists no Superstar II shoe except a Pokémon edition at ₹11,999; the plain Superstar II address returned an empty page | Unconfirmed for the plain shoe | [adidas.co.in/superstar](https://www.adidas.co.in/superstar) |
| **New Balance 550** | The India site could not be opened (newbalance.co.in did not load for my tools; newbalance.in is a parked domain). Reported: Amazon.in listings carry an MRP of ₹14,999, selling lower (price-tracker pages, late Sep 2026) | Unconfirmed official; Reported | [price tracker](https://pricehistory.app/p/new-balance-men-bb550-sneaker-IwJIUKSj) |
| **Puma Speedcat** | "Speedcat Sneakers" 406004 **₹9,999**, "Prices include GST"; Speedcat OG ₹9,999; Plus ₹10,999; Ballet ₹6,999; Go ₹5,999 (marked down from ₹7,999) | Confirmed | [in.puma.com 406004](https://in.puma.com/in/en/pd/speedcat-sneakers/406004) |
| **ASICS Gel-1130** | The plain GEL-1130 is not among the 23 sportstyle shoes on asics.co.in today; the ATMOS x GEL-1130 RE collaboration is **₹14,999**. Reported: Nykaa lists the GEL-1130 at an ₹8,999 regular price, sold by ASICS India. | Confirmed for the collaboration only; plain shoe Reported | [asics.co.in](https://www.asics.co.in/all-sportstyle.html), [Nykaa](https://www.nykaa.com/asics-gel-1130-women-beige-sneakers/p/21310012) |

Note: nike.in shows "Sold By Nykaa Fashion Ltd" on product pages, so Nike's India online store is run with a retail partner (Confirmed on the page).

## Materials, construction and origin (brand pages)
| Shoe | What the brand page says | Origin | Status | Source |
|---|---|---|---|---|
| **Nike Air Force 1 '07** | Leather upper with perforated toe; foam midsole; rubber outsole with pivot circles | CW2288-111 (Romania page): China, India, Vietnam. India page FJ4146-137: **Vietnam** (Dona Pacific, Dong Nai) | Confirmed | [nike.com RO](https://nike.com/ro/t/air-force-1-07-shoes-rWtqPn/CW2288-111), [nike.in](https://www.nike.in/nike-air-force-1-07-men-s-shoes/p/29403441) |
| **Nike Dunk Low** | India page says "premium materials and plush padding", with no breakdown. The earlier cupsole/foam wording in the fact bank came from a Nike page for older kids. | HF5441-105: **Vietnam** (Ching Luh, Ben Luc), importer Nike India Pvt Ltd | Origin Confirmed; materials not on this page | [nike.in](https://www.nike.in/nike-dunk-low-retro-men-s-shoes/p/24948349) |
| **Air Jordan 1 Low** | DC0774 (Singapore page, women's, colour 001): leather and synthetic mix upper, foam midsole, rubber traction | DC0774-001: Vietnam. India page DC0774-160: **Indonesia** (PT Adis Gelora Gemilang) | Confirmed per style code | [nike.com SG](https://nike.com/sg/t/air-jordan-1-low-shoes-459b4T/DC0774-050), [nike.in](https://www.nike.in/nike-air-jordan-1-low-women-s-shoes/p/29403336) |
| **adidas Samba OG** (B75807) | "soft leather upper, suede overlays and gum sole" | Not shown on the page text I could read | Materials Confirmed | [adidas.co.in](https://www.adidas.co.in/samba-og-shoes/B75807.html) |
| **adidas Campus 00s** | HQ8708: premium leather upper, textile terry lining, off-white midsole. JR8163: suede upper. | Not shown | Confirmed per style code | [HQ8708](https://www.adidas.co.in/campus-00s-shoes/HQ8708.html), [JR8163](https://www.adidas.co.in/campus-00s-shoes/JR8163.html) |
| **adidas Superstar II**, **Yeezy 350 V2** | adidas India does not list them; adidas UK pages returned "403 Forbidden" to my tools | n/a | Unconfirmed | n/a |
| **Puma Speedcat** | India page lists no materials (only width, closure, "Lifestyle"). The fact bank's Moldova listing (97.82% cow leather) stays as the only composition source. | The page does not state origin (a stray "India" text line may be a site label; do not use it) | Unconfirmed | [in.puma.com](https://in.puma.com/in/en/pd/speedcat-sneakers/406004) |
| **New Balance 550**, **ASICS Gel-1130** | Brand pages returned "403 Forbidden" or did not load | n/a | Unconfirmed; keep as Reported | n/a |

## Risks and unknowns
- Prices change daily and by colourway; the pages show many prices per shoe. Quote a style code and date.
- Origin changes by style code and even between pages for one shoe (Air Jordan 1 Low: Vietnam on one page, Indonesia on another). Say "this style code is made in …", never "the shoe is made in …".
- I read only the first listing page for Air Force 1 and Air Jordan 1.
- Brand pages block automated fetching (403) for adidas UK, New Balance and ASICS global; the in-app browser worked for India pages.

## What I would do next
1. Social: use the corrected Dunk and Campus lines. Quote ₹8,295 (Dunk Low Retro, HF5441-105) and ₹10,999 (Samba OG B75807) with "checked 2026-10-23".
2. Data team: check how `sneakers.retail_price` is filled (Samba OG shows ₹9,350 against ₹10,999 on adidas India); add a refreshed MRP column from these India pages.
3. Someone with the shoe in hand or a normal browser: read the New Balance 550 and ASICS Gel-1130 official pages, and a tag photo for Puma.
