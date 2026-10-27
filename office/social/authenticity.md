# Real versus fake basics bank

Used by `scripts/social_posts.py` for the "legit" slot. Source: R&D, `office/research/2026-10-23-real-vs-fake-basics.md`. Rules: no post names any seller, store or marketplace as fake or real; brand-neutral checks only; every check says it is not proof. The brands publish very little: only New Balance has an official check (a QR on the tongue label). Format: `@item <id> | <confidence>`, then `text:` and `sources:`. Not reused within 30 days.

@item check-where | Confirmed
text: Fake-check 1: where you bought it. ASICS India, Puma India and New Balance each say genuine pairs come from their own stores and authorised retailers. Nike's returns rules also require an authorised dealer. This names no shop: ask a seller if it is authorised.
sources: https://www.asics.co.in/termsconditions ; https://in.puma.com/in/en/help/warranty-claims ; https://www.newbalance.com/counterfeit_landing_page.html ; https://www.nike.com/help/claims/guidelines

@item check-price | Confirmed
text: Fake-check 2: a price far below MRP is a red flag. New Balance and ASICS both say so. It is not proof, since stores run real markdowns. Look up the brand's India MRP for the style code first, then compare.
sources: https://www.newbalance.com/counterfeit_landing_page.html ; https://www.asics.com/sg/en-sg/customer-service/beware-of-scams/beware-of-scams.html

@item check-sites | Confirmed
text: Fake-check 3: a brand name in a web address does not make a site licensed. ASICS and New Balance warn about "brand plus shop or outlet" sites. That is not a certain sign either. Open the brand's own site yourself.
sources: https://www.asics.com/sg/en-sg/customer-service/beware-of-scams/beware-of-scams.html ; https://www.newbalance.com/counterfeit_landing_page.html

@item check-compare | Reported
text: Fake-check 4: compare your pair with the brand's own India page for the same style code: colours, materials, details. Nike India even lists a factory per style code (Dunk Low HF5441-105: Vietnam). The code alone proves nothing, it is easy to copy. A mismatch means look closer.
sources: https://www.nike.in/nike-dunk-low-retro-men-s-shoes/p/24948349

@item check-nb | Confirmed
text: New Balance says tongue labels are moving to a QR code (from May 2025). Scan it and compare the size and details on the page with the shoe; a mismatch means not authentic, it says. Older pairs have a data matrix. A printed code can be copied: compare, don't just scan.
sources: https://www.newbalance.com/counterfeit_landing_page.html

@item check-none | Reported
text: Fake-check 5: no single sign proves a pair. A tag, a QR scan or an "authenticated" sticker can each be copied or wrong. A US court found StockX liable for selling 37 counterfeit Nike pairs (2025, later settled). We name no store as real or fake.
sources: https://www.complex.com/sneakers/a/victor-deng/nike-stockx-lawsuit-counterfeit-sneakers ; https://news.bloomberglaw.com/ip-law/nike-stockx-settle-nft-counterfeiting-lawsuit-ahead-of-trial
