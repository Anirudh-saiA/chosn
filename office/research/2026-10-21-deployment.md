# Where should CHOSN deploy (API, website, Postgres, Redis, pictures/PDFs, scheduled jobs), and what does it cost per month?

**Answer / recommendation:** Launch on **Railway, Singapore region, everything in one project (Setup A)**: about **₹2,700 a month** (likely range ₹1,900 to ₹4,300). It is the cheapest managed option, the code already assumes it, and it needs no new tooling. Put pictures and PDFs on **Cloudflare R2** (₹0 at launch size). Move the website to Vercel Pro (Setup C, about ₹3,900) only if the Next.js app proves slow or heavy on Railway. Render (Setup B, about ₹10,000) costs roughly four times as much for no benefit we need yet.
**Confidence:** medium. **Why:** the prices are from official pages read on 2026-10-21, but Railway bills by actual use and I have not measured CHOSN's real memory and CPU, so the monthly totals are my estimates.

**Rates used:** ₹96.5 per US$ (Pluang, 2026-10-21, one source) and ₹110 per € (July 2026 sources, so possibly stale). GST and card foreign-exchange fees are not included.

## What the code needs (read from the repo, commit ea31a7d)
- Two Node apps: `apps/api` (NestJS 12) and `apps/web` (Next.js 16), plus Postgres (Drizzle) and Redis (BullMQ).
- **The schedulers run inside the API process** (BullMQ repeat jobs, plus `setInterval` for drop reminders, the waitlist drip and fetch-health logging). So the API **must be always on**: no free tier that sleeps, and no scale-to-zero. The file `.github/workflows/railway-keepalive.yml` exists for this reason.
- Picture uploads already go through the S3-compatible `storage.service.ts` (`STORAGE_*` variables) and need a **public bucket**. It stays disabled until credentials exist.
- There is **no Dockerfile or railway config in the repo**. Railway builds from git with its defaults, and the old production API (`chosnapi-production.up.railway.app`) no longer exists. A fresh deploy is needed on any host. This is a request for Back end (see "What I would do next").
- Because the schedulers sit in the API, hosted cron jobs (Railway, Render) are not needed. Both would work for the 10-minute news cycle: Railway's cron minimum is 5 minutes, and Render's cron is billed by the second.

## Options compared
Assumed usage (my assumption, to be checked after one week live): API 0.5 GB RAM and 0.2 vCPU; web 0.5 GB and 0.15 vCPU; Postgres 0.5 GB and 0.1 vCPU with a 3 GB volume; Redis 0.1 GB; 30 GB a month of outbound traffic.

| Setup | What runs where | Cost per month (INR, 2026-10-21) | Pros | Cons | Source |
|---|---|---|---|---|---|
| **A. Railway only** (Hobby $5 plan, Singapore) | API, web, Postgres, Redis all on Railway. Pictures on R2. | **≈ $28, about ₹2,700** (range $20 to $45). Working: API $9, web $8, Postgres $7.50, Redis $2, traffic $1.50. The $5 plan fee is covered by the usage. | Cheapest managed option. Billed on real use. Code already reads Railway variables. Git deploys. Always-on. | No India region (Singapore is nearest). Hobby volumes are capped at 5 GB, so move to Pro ($20 plus usage) once the price history grows. Railway documents no managed Postgres backup plan in the pages I read, so backups are unverified. | [Railway plans](https://docs.railway.com/pricing/plans), [regions](https://docs.railway.com/reference/deployment-regions) |
| **B. Render** (Pro workspace, Singapore) | API and web on the Standard plan (1 CPU, 2 GB) at $25 each. Postgres Basic-1gb at $19. Key Value 256 MB at $10. Workspace fee $25. | **≈ $104, about ₹10,000.** Hobby workspace ($0) would be about $79, about ₹7,600, but it has 1 seat and 5 GB of included traffic. I could not confirm that Hobby allows commercial use. | Flat, predictable prices. Managed Postgres with point-in-time recovery (3 days). Singapore region. | Four times Setup A. Traffic beyond 25 GB costs $0.15 per GB, three times Railway's. Cheaper Starter instances ($7, 512 MB) are probably too small for Nest or Next, which is my inference. | [Render pricing](https://render.com/pricing), [regions](https://render.com/docs/regions), [bandwidth](https://render.com/docs/outbound-bandwidth) |
| **C. Vercel Pro for the website, Railway for the rest** | Web on Vercel Pro ($20 per seat). API, Postgres, Redis on Railway. Pictures on R2. | **≈ $40, about ₹3,900.** Working: Vercel $20 plus Railway $20. | Best site speed. Vercel has a Mumbai (bom1) function region and a CDN. 1 TB of traffic included. Preview deploys. | Two vendors. Usage beyond the $20 credit is billed on top (a spend cap of $200 is the default). **Vercel's free Hobby plan cannot be used: it bars commercial use, and its definition of commercial includes affiliate links, which CHOSN earns.** | [Vercel pricing](https://vercel.com/pricing), [fair use](https://vercel.com/docs/limits/fair-use-guidelines), [regions](https://vercel.com/docs/regions) |
| **D. One Hetzner server in Singapore** (self-managed) | API, web, Postgres, Redis on one CPX22 (2 vCPU, 4 GB) using the existing `docker-compose.yml`. | **€26.99, about ₹2,970,** excluding VAT. I could not find the IPv4 add-on price, so the total is a little higher. | Cheapest per unit of compute. Fixed price. 1 TB of traffic included. | We run backups, patching, restarts and monitoring ourselves. One server is a single point of failure. The new price list shows Singapore at €26.99 against €19.99 in Germany. The CX23 (€5.99) is not offered in Singapore. | [Hetzner CPX](https://www.hetzner.com/cloud/regular-performance/), [Hetzner cloud](https://www.hetzner.com/cloud) |

### Storage for pictures and PDFs (any setup)
| Option | Cost (INR, 2026-10-21) | Notes | Source |
|---|---|---|---|
| **Cloudflare R2** | Free up to 10 GB-month, 1 M writes, 10 M reads. Beyond that $0.015 per GB-month (about ₹1.45), egress free. For example 50 GB costs about ₹58. | Already fits `storage.service.ts` (S3-compatible). **Production public access needs a custom domain whose DNS zone is on Cloudflare.** Cloudflare says `r2.dev` is for development only and rate-limited. So this waits for the domain purchase. | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) (updated 2026-10-01), [public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) (2026-09-25) |
| Railway volume | $0.15 per GB-month | Not suited to a CDN; a volume is attached to one service. | [Railway plans](https://docs.railway.com/pricing/plans) |

### Managed alternatives checked and not recommended now
- **Neon Postgres** (Launch: $0.106 per compute-hour, $0.35 per GB-month). Our API polls the database constantly, so the compute would never sleep: about 0.25 compute-units always on is roughly $19 a month, my arithmetic. It buys nothing over Railway's Postgres. The pricing page did not list regions. [Neon pricing](https://neon.com/pricing)
- **Upstash Redis.** Pay-as-you-go is $0.20 per 100,000 commands. BullMQ polls all day, so idle polling alone can run $5 or more a month (my arithmetic). The fixed $10 plan avoids that. Railway's own Redis is cheaper. [Upstash pricing](https://upstash.com/pricing/redis)

## Evidence
- Railway Hobby is $5 a month with $5 of usage included. Rates are $10 per GB RAM, $20 per vCPU, $0.05 per GB egress, $0.15 per GB volume. Hobby volumes are capped at 5 GB, and Pro is $20 with $20 of usage ([Railway](https://docs.railway.com/pricing/plans), read 2026-10-21, no page date).
- Railway has four regions: US West, US East, Amsterdam and **Singapore**. No India region ([Railway regions](https://docs.railway.com/reference/deployment-regions), 2026-10-21).
- Railway cron: five-field UTC schedule, at least 5 minutes between runs, a run is skipped if the previous one is still active ([Railway cron](https://docs.railway.com/reference/cron-jobs), 2026-10-21).
- Render: Pro workspace $25 a month, Standard (1 CPU, 2 GB) $25, Postgres Basic-1gb $19, Key Value 256 MB $10, bandwidth 25 GB on Pro then $0.15 per GB. Regions are Oregon, Ohio, Virginia, Frankfurt and Singapore, with no India region ([Render pricing](https://render.com/pricing) read in a browser, [regions](https://render.com/docs/regions), 2026-10-21).
- Vercel Pro is $20 per seat with 1 TB of transfer and 10 M requests. Hobby is "non-commercial personal use only", and affiliate linking is listed as commercial ([Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines), updated 2026-09-14). Mumbai bom1 is a compute region ([Vercel regions](https://vercel.com/docs/regions), updated 2026-08-11).
- Hetzner CPX22: €19.99 in Germany or Finland and €26.99 in Singapore; Singapore includes only 1 TB of traffic, with extra TB charged at a high rate ([Hetzner](https://www.hetzner.com/cloud/regular-performance/), 2026-10-21).
- Exchange rates: US$1 = ₹96.5 ([Pluang](https://pluang.com/en/tools/currency-converter/usd-inr)); €1 = ₹110 ([Pluang EUR](https://pluang.com/en/tools/currency-converter/eur-inr), 2026-07-22).

## Risks and unknowns
- **The totals are estimates.** Railway bills by actual RAM and CPU. Real use could be double. Check the first weekly bill and set Railway's usage limit.
- **Latency to India.** No provider here has an India region for the backend. Singapore is nearest; I expect roughly 50 to 100 ms from Indian cities, but I have not measured it. Only Vercel offers a Mumbai region, for the web layer.
- **Postgres backups on Railway.** I did not verify how backups work on Railway. Before real user data lands (accounts, wishlists), the founder needs a tested backup and restore. Back end to confirm.
- **R2 depends on the domain.** Public pictures at scale need the custom domain on Cloudflare. Until then, uploads stay off, as they are today.
- **Hobby terms.** I did not check whether Railway's Hobby plan allows commercial use. Check before launch, since CHOSN earns affiliate commission.
- **Not covered:** e-mail (Resend, already used), push notifications, error tracking (Sentry, already used), and domain cost. These are separate questions.
- Render's and Hetzner's pages carried no date, and Hetzner's IPv4 price was not found.

## What I would do next
1. Founder decides: Setup A for launch (my recommendation), and R2 once the domain is bought.
2. **Request to Back end:** a deploy checklist for Railway (build and start commands for api and web, `PORT`, the healthcheck, migrations run at start) and a tested Postgres backup and restore routine. Also confirm that Redis settings suit BullMQ (no key eviction).
3. **Request to Main:** after one week live, re-run the cost with real usage from Railway's dashboard, and re-check Hobby's terms.
4. R&D follow-up if wanted: measure latency from India to Singapore versus Mumbai, and price Vercel bom1 regional traffic.
