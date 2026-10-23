"""Daily X (Twitter) post drafts for CHOSN, in the critic voice (see office/social/voice.md).

Reads the fact bank (office/social/facts/*.md), office/social/random.md and our own database (SELECT only,
through docker exec psql) and writes office/social/posts/<date>.md. It posts nothing: the founder copies the text.

Two posts a day (about 09:00 and 19:00 IST), each within 280 characters as X counts them. The kind of post rotates by weekday:
  reality  a specific shoe: materials, construction, price in rupees (fact bank), with the criticism and a review source
  question a question about that shoe
  sale     the biggest listed discount in our own price data (store price against the MRP the store shows)
  drops    new releases from our drop calendar, with retail price and how firm each date is
  collab   the latest collab story (headline + credit only) with a question
  news     the latest unexpected story (headline + credit only) with a question
  random   a culture or retail prompt from office/social/random.md
  controversy, fact   sourced items from office/social/controversies.md and trivia.md
  market   our own market numbers: the same pair at two prices, new listings, markdowns by store
  wearing  what Indian stores stock most (not what people wear) and a question to the readers
If a new shoe releases today (our drop calendar), the morning post is the drops post.
Every post lists its sources and a confidence line (Confirmed / Reported / Opinion). Nothing repeats within 30 days.

Usage: python scripts/social_posts.py [--date YYYY-MM-DD] [--stdout]
Set SOCIAL_SITE_URL (e.g. https://chosn.in) once the domain exists; until then no link is added.
"""
import argparse
import datetime
import os
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import social_images  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
FACTS = ROOT / "office" / "social" / "facts"
POSTS = ROOT / "office" / "social" / "posts"
RANDOM = ROOT / "office" / "social" / "random.md"
BANKS = {"controversy": ROOT / "office" / "social" / "controversies.md", "fact": ROOT / "office" / "social" / "trivia.md"}
PG = ["docker", "exec", "chosn-postgres-1", "psql", "-U", "postgres", "-d", "chosn_dev", "-At", "-F", "|", "-c"]
SITE = os.environ.get("SOCIAL_SITE_URL", "").rstrip("/")
LIMIT = 280
REPEAT_DAYS = 30
FIRM = {"confirmed": "confirmed", "reported": "reported", "unconfirmed": "rumoured"}
CONF = {"confirmed": "Confirmed", "reported": "Reported", "unconfirmed": "Unconfirmed"}
# listing prices come from these stores only: resale stores would mix a different kind of price into the range
STORES = ("Myntra", "Ajio", "Flipkart", "Superkicks", "Puma India", "VegNonVeg")
SLOTS = {0: ("market", "fact"), 1: ("drops", "sale"), 2: ("controversy", "wearing"), 3: ("collab", "reality"),
         4: ("sale", "market"), 5: ("news", "fact"), 6: ("controversy", "random")}  # weekday (Monday = 0) -> (morning, evening)
FALLBACK = {"morning": ("fact", "market", "reality", "random", "drops"), "evening": ("fact", "market", "random", "question", "reality")}
NEWS_ASK = "What would you want to know about the materials and the price before buying? Reply and we will check the spec."
CULTURE_ASK = "Does this change how you buy or wear sneakers, or is it noise? Tell us why."
COLLAB_ASK = "Beyond the logo, what would this collab have to change in the shoe for you to pay more?"
SKIP_TITLE = "(title ilike '%your chance%' or title ilike '%giveaway%' or title ilike '%discount code%')"  # promotions, not news


def q(sql):
    r = subprocess.run(PG + [sql], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        sys.exit("database query failed: " + r.stderr.strip()[:300])
    return [line.split("|") for line in r.stdout.splitlines() if line]


def esc(s):
    return s.strip().replace("'", "''")


def clip(text, n):
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def x_len(text):
    """Length as X counts it: most letters 1, characters outside its single-weight ranges (₹, …) 2, any link 23."""
    text = re.sub(r"https?://\S+", "x" * 23, text)
    n = 0
    for ch in text:
        c = ord(ch)
        n += 1 if (c <= 4351 or 8192 <= c <= 8205 or 8208 <= c <= 8223 or 8242 <= c <= 8247) else 2
    return n


def fit(make, name):
    """make(name) -> text. Shorten the name until the post fits."""
    n = 80
    while True:
        text = make(clip(name, n))
        if x_len(text) <= LIMIT or n <= 20:
            return text
        n -= 8


def rupees(v):
    return f"₹{int(v):,}"


# ---- fact bank -------------------------------------------------------------------------------------------

def load_facts():
    """Fact-bank files -> [{slug, title, db, checked, posts: [{id, conf, text, sources}], questions: [{id, text}]}]."""
    facts = []
    for f in sorted(FACTS.glob("*.md")):
        if f.name.lower() == "readme.md":
            continue
        lines = f.read_text(encoding="utf-8").splitlines()
        d = {"file": f.name, "title": lines[0].lstrip("# ").strip(), "slug": f.stem, "db": [], "checked": "", "posts": [], "questions": []}
        cur = None
        for ln in lines[1:]:
            if ln.startswith("slug:"):
                d["slug"] = ln.split(":", 1)[1].strip()
            elif ln.startswith("db:"):
                d["db"] = [p.strip().split("|", 1) for p in ln.split(":", 1)[1].split(",") if "|" in p]
            elif ln.startswith("checked:"):
                d["checked"] = ln.split(":", 1)[1].strip()
            elif ln.startswith("@post "):
                pid, _, conf = ln[6:].partition("|")
                cur = {"id": pid.strip(), "conf": conf.strip() or "Reported", "text": "", "sources": []}
                d["posts"].append(cur)
            elif ln.startswith("@question "):
                cur = {"id": ln[10:].strip(), "text": ""}
                d["questions"].append(cur)
            elif cur is not None and ln.startswith("text:"):
                cur["text"] = ln.split(":", 1)[1].strip()
            elif cur is not None and ln.startswith("sources:"):
                cur["sources"] = [s.strip() for s in ln.split(":", 1)[1].split(" ; ") if s.strip()]
        facts.append(d)
    return facts


def prices(db):
    """Live listing prices in rupees for the fact file's models: dict(min, med, max, n) or None."""
    if not db:
        return None
    pairs = " or ".join(f"(lower(s.brand)=lower('{esc(b)}') and lower(s.model)=lower('{esc(m)}'))" for b, m in db)
    stores = ",".join(f"'{s}'" for s in STORES)
    rows = q(f"""select count(*), min(ps.price)::int, percentile_cont(.5) within group (order by ps.price)::int, max(ps.price)::int
      from sneakers s join sneaker_variants v on v.sneaker_id=s.id
      join price_snapshots ps on ps.sneaker_variant_id=v.id and ps.is_latest and ps.in_stock and ps.condition='new' and ps.currency='INR' and ps.price>=2000
      join retailers r on r.id=ps.retailer_id and r.name in ({stores})
      where s.gender in ('men','women','unisex') and ({pairs})""")
    if not rows or not rows[0][0] or rows[0][0] == "0":
        return None
    n, lo, med, hi = rows[0]
    return {"n": int(n), "min": int(lo), "med": int(med), "max": int(hi)}


def fill(text, pr):
    if "{" not in text:
        return text
    if not pr:
        return None
    r = lambda v: f"{v:,}"
    return text.replace("{min}", r(pr["min"])).replace("{med}", r(pr["med"])).replace("{max}", r(pr["max"])).replace("{n}", str(pr["n"]))


def recent_ids(day):
    """Ids used in drafts of the previous REPEAT_DAYS days."""
    used = set()
    d = datetime.date.fromisoformat(day)
    for f in POSTS.glob("*.md"):
        try:
            fd = datetime.date.fromisoformat(f.stem)
        except ValueError:
            continue
        if fd != d and 0 < (d - fd).days <= REPEAT_DAYS:
            m = re.search(r"<!-- ids: ([^>]*?) -->", f.read_text(encoding="utf-8"))
            if m:
                used.update(x.strip() for x in m.group(1).split(","))
    for f in POSTS.parent.glob("week-*.md"):
        for m in re.finditer(r"<!-- slot (\S+) \w+ \| \w+ \| ([^>]*?) -->", f.read_text(encoding="utf-8")):
            if m.group(1) != day:
                used.add(m.group(2).strip())
    return used


def pack_entries(day):
    """Evergreen slots already scheduled from a weekly pack (scripts/social_week.py): {slot: (kind, id)}."""
    found = {}
    for f in POSTS.parent.glob("week-*.md"):
        for m in re.finditer(r"<!-- slot (\S+) (\w+) \| (\w+) \| ([^>]*?) -->", f.read_text(encoding="utf-8")):
            if m.group(1) == day:
                found[m.group(2)] = (m.group(3), m.group(4).strip())
    return found


# ---- post kinds: each returns a dict or None ------------------------------------------------------------------

def k_reality(day, ctx):
    facts = ctx["facts"]
    start = datetime.date.fromisoformat(day).toordinal() % max(len(facts), 1)
    for i in range(len(facts)):
        fct = facts[(start + i) % len(facts)]
        pr = prices(fct["db"])
        for p in fct["posts"]:
            if p["id"] in ctx["used"]:
                continue
            text = fill(p["text"], pr)
            if text is None:
                continue
            src = list(p["sources"])
            if pr:
                src.append(f"Our own data: {pr['n']} in-stock new listings at {', '.join(STORES)}, read {day}; listing prices, not MRP, mixed colourways")
            ctx["fact"] = fct
            return {"label": "reality: a specific shoe", "text": text, "conf": p["conf"], "ids": [p["id"]], "sources": src,
                    "note": f"fact file `office/social/facts/{fct['file']}` (checked {fct['checked']})", "slug": fct["slug"], "title": fct["title"]}
    return None


def k_question(day, ctx):
    facts = ctx["facts"]
    order = ([ctx["fact"]] if ctx.get("fact") else []) + facts
    for fct in order:
        pr = prices(fct["db"])
        for x in fct["questions"]:
            text = fill(x["text"], pr) if x["id"] not in ctx["used"] else None
            if text:
                return {"label": "community question about a shoe", "text": text, "conf": "Opinion", "ids": [x["id"]], "sources": [],
                        "note": "a question, no claim", "slug": fct["slug"], "title": fct["title"]}
    return None


def k_random(day, ctx):
    if not RANDOM.exists():
        return None
    lines = [ln[2:].strip() for ln in RANDOM.read_text(encoding="utf-8").splitlines() if ln.startswith("- ")]
    start = datetime.date.fromisoformat(day).toordinal() % max(len(lines), 1)
    for i in range(len(lines)):
        idx = (start + i) % len(lines)
        rid = f"random-{idx + 1}"
        if rid not in ctx["used"] and x_len(lines[idx]) <= LIMIT:
            return {"label": "random: culture and retail", "text": lines[idx], "conf": "Opinion", "ids": [rid], "sources": [],
                    "note": "a question or a marked opinion (`office/social/random.md`)", "slug": "", "title": "a shoe or shop moment you like"}
    return None


def k_sale(day, ctx):
    stores = ",".join(f"'{s}'" for s in STORES)
    rows = q(f"""select distinct on (s.id, r.id) s.brand||' '||s.model||' '||s.colorway, r.name, ps.price::int, ps.compare_at_price::int,
        round(100*(1-ps.price/ps.compare_at_price))::int, ps.listing_url, ps.fetched_at::date
      from price_snapshots ps join sneaker_variants v on v.id=ps.sneaker_variant_id join sneakers s on s.id=v.sneaker_id
      join retailers r on r.id=ps.retailer_id and r.name in ({stores})
      where ps.is_latest and ps.in_stock and ps.condition='new' and ps.currency='INR' and ps.price>=2000 and ps.compare_at_price>ps.price
        and s.gender in ('men','women','unisex') and ps.fetched_at>='{day}'::date - 3 order by s.id, r.id, ps.fetched_at desc""")
    rows = sorted(rows, key=lambda r: -int(r[4]))[:15]
    start = datetime.date.fromisoformat(day).toordinal() % max(len(rows), 1)
    for i in range(len(rows)):
        name, store, price, mrp, pct, url, seen = rows[(start + i) % len(rows)]
        key = "sale:" + re.sub(r"[^a-z0-9-]", "", url.rstrip("/").rsplit("/", 1)[-1].lower())[:40]
        if key in ctx["used"] or int(pct) < 20:
            continue
        make = lambda n: (f"Listed today: {n} at {store}, {rupees(price)}. The same listing shows an MRP of {rupees(mrp)}, {pct}% off. "
                          "My take: a discount from a high list price is not a bargain by itself. Check the style code, the sizes left and the return policy.")
        return {"label": "sale: biggest listed discount in our data", "text": fit(make, name), "conf": "Reported", "ids": [key],
                "sources": [url, f"Our own data: store listing read {seen}; the MRP is the one the store shows, not checked against the brand's"],
                "note": "a store listing, so re-check the price and sizes before posting", "slug": "", "title": name}
    return None


def k_drops(day, ctx):
    rows = q(f"""select s.brand||' '||s.model||' '||s.colorway, d.release_date, d.confirmation, d.india_status, coalesce(d.retail_price::int::text,'')
      from drop_events d join sneakers s on s.id=d.sneaker_id
      where not d.hidden and not d.is_demo and d.release_date between '{day}' and '{day}'::date+7
      order by (d.release_date='{day}') desc, (d.confirmation='confirmed') desc, (d.confirmation='reported') desc,
        (d.india_status='confirmed_india') desc, d.release_date limit 12""")
    d = datetime.date.fromisoformat(day)
    today = [r for r in rows if r[1] == day]
    pick = (today or rows)[:3]
    if not pick:
        return None
    head = f"Drops today, {d.strftime('%a %d %b')}" if today else "Coming up this week"
    lines = []
    for name, rd, conf, india, price in pick:
        when = "" if rd == day else f" ({datetime.date.fromisoformat(rd).strftime('%a %d %b')})"
        pr = f" ₹{int(price):,}" if price.isdigit() and int(price) >= 1000 else ""  # tiny values are dollar prices stored as rupees: leave out
        lines.append(f"• {clip(name, 60)}{when}{pr}, {FIRM.get(conf, conf)}")
    foot = "Dates marked rumoured are not final. We update as they firm up."
    tail = f"\n{SITE}/releases" if SITE else ""
    text = f"{head}\n\n" + "\n".join(lines) + f"\n\n{foot}{tail}"
    while x_len(text) > LIMIT and len(lines) > 1:
        lines.pop()
        text = f"{head}\n\n" + "\n".join(lines) + f"\n\n{foot}{tail}"
    firm = "Confirmed" if all(r[2] == "confirmed" for r in pick) else "Reported"
    return {"label": "new releases from our drop calendar", "text": text, "conf": firm, "ids": [f"drops-{day}"],
            "sources": [f"Our own drop calendar (drop_events), read {day}; each line says confirmed, reported or rumoured"],
            "note": "dates can move: re-check before posting", "slug": "", "title": pick[0][0]}


def k_news(day, ctx, collab=False):
    cond = "category='collab'" if collab else "category in ('release','culture')"
    rows = q(f"""select id::text, title, source, coalesce(source_url,''), coalesce(image_url,''), category from news_items
      where dup_of is null and not is_demo and published_at >= '{day}'::date - 2 and {cond} and not {SKIP_TITLE}
        and (array_length(brands,1)>0 or source in ('Highsnobiety','Hypebeast','Footwear News','Sneaker News','Complex'))
      order by is_breaking desc, india desc, published_at desc limit 10""")
    for nid, title, source, url, img, cat in rows:
        key = ("collab:" if collab else "news:") + nid[:8]
        if key in ctx["used"]:
            continue
        text = f"{clip(title, 150)}\n(via {source})\n\n{COLLAB_ASK if collab else (NEWS_ASK if cat == 'release' else CULTURE_ASK)}"
        pic = (f"data/media{img[len('/media'):]}" if img.startswith("/media/") else img)
        return {"label": "collab news" if collab else "unexpected news", "text": clip(text, LIMIT), "conf": "Reported", "ids": [key],
                "sources": [url or f"{source} (headline and credit only)"], "note": "headline and credit only, never publisher text; add your own line if you have one",
                "slug": "", "title": title, "picture": f"Picture to attach (credit the source): {pic}" if pic else ""}
    return None


def k_bank(kind):
    """Sourced items from controversies.md / trivia.md, rotated by date, not repeated within 30 days."""
    def run(day, ctx):
        path = BANKS[kind]
        if not path.exists():
            return None
        items, cur = [], None
        for ln in path.read_text(encoding="utf-8").splitlines():
            if ln.startswith("@item "):
                iid, _, conf = ln[6:].partition("|")
                cur = {"id": f"{kind}:{iid.strip()}", "conf": conf.strip() or "Reported", "text": "", "sources": []}
                items.append(cur)
            elif cur is not None and ln.startswith("text:"):
                cur["text"] = ln.split(":", 1)[1].strip()
            elif cur is not None and ln.startswith("sources:"):
                cur["sources"] = [s.strip() for s in ln.split(":", 1)[1].split(" ; ") if s.strip()]
        start = datetime.date.fromisoformat(day).toordinal() % max(len(items), 1)
        for i in range(len(items)):
            it = items[(start + i) % len(items)]
            if it["id"] not in ctx["used"] and it["text"] and x_len(it["text"]) <= LIMIT:
                note = "criticises the product, price or company decision, not a person; skim a source before posting" if kind == "controversy" else "skim a source before posting"
                return {"label": "controversy" if kind == "controversy" else "interesting fact", "text": it["text"], "conf": it["conf"], "ids": [it["id"]],
                        "sources": it["sources"], "note": note, "slug": "", "title": it["text"].split(":")[0]}
        return None
    return run


def k_market(day, ctx):
    """Our own market numbers; the kind of stat rotates, each at most once a week (spread: once per pair)."""
    stores = ",".join(f"'{s}'" for s in STORES)
    week = datetime.date.fromisoformat(day).isocalendar()
    order = ["spread", "markdown", "newlist"]
    start = datetime.date.fromisoformat(day).toordinal() % 3
    for i in range(3):
        sub = order[(start + i) % 3]
        if sub == "spread":
            rows = q(f"""select name, lo_store, lo, hi_store, hi, round(100.0*(hi-lo)/lo)::int from (
              select s.brand||' '||s.model||' '||s.colorway name, (array_agg(r.name order by x.p))[1] lo_store, min(x.p)::int lo,
                (array_agg(r.name order by x.p desc))[1] hi_store, max(x.p)::int hi, count(*) n
              from (select v.sneaker_id sid, ps.retailer_id rid, min(ps.price) p from price_snapshots ps join sneaker_variants v on v.id=ps.sneaker_variant_id
                where ps.is_latest and ps.in_stock and ps.condition='new' and ps.currency='INR' and ps.price>=2000 group by 1,2) x
              join sneakers s on s.id=x.sid join retailers r on r.id=x.rid and r.name in ({stores}) where s.gender in ('men','women','unisex') group by s.id) t
              where n>=2 and hi>lo order by (hi-lo)::numeric/lo desc limit 10""")
            for name, lo_s, lo, hi_s, hi, pct in rows:
                key = "market:spread:" + re.sub(r"[^a-z0-9]", "", name.lower())[:40]
                if key in ctx["used"]:
                    continue
                make = lambda n: (f"Same pair, two prices. {n}: {rupees(lo)} at {lo_s}, {rupees(hi)} at {hi_s}, {pct}% more. Both new and in stock, same style code. "
                                  "My take: check a second store before you pay the higher price.")
                return {"label": "market: the same pair at two prices", "text": fit(make, name), "conf": "Reported", "ids": [key],
                        "sources": [f"Our own data: lowest in-stock new listing per store, read {day}; the lower price can be a markdown, the higher the full MRP"],
                        "note": "re-check both listings before posting", "slug": "", "title": name}
        elif sub == "markdown":
            key = f"market:markdown:{week[0]}-w{week[1]}"
            if key in ctx["used"]:
                continue
            rows = q(f"""select r.name, count(*), count(*) filter (where ps.compare_at_price>ps.price),
                round(percentile_cont(.5) within group (order by 100*(1-ps.price/ps.compare_at_price)) filter (where ps.compare_at_price>ps.price))::int
              from price_snapshots ps join retailers r on r.id=ps.retailer_id and r.name in ({stores})
              where ps.is_latest and ps.in_stock and ps.condition='new' and ps.currency='INR' group by 1 order by 3 desc""")
            marked = [r for r in rows if int(r[2]) > 0]
            if not marked:
                continue
            parts = "; ".join(f"{n}: {int(m):,} of {int(a):,} listings show a markdown, median {p}% off" for n, a, m, p in marked[:2])
            rest = "" if len(marked) == len(rows) else f" The other {len(rows) - len(marked)} stores show no struck-through price in our data."
            text = f"Markdown watch ({day[5:]}). {parts}.{rest} My take: a % off a high list price is not a bargain by itself. Check the style code and the size run."
            return {"label": "market: markdowns by store", "text": clip(text, 275), "conf": "Reported", "ids": [key],
                    "sources": [f"Our own data: in-stock new listings at {', '.join(STORES)}, read {day}; a markdown is a price below the MRP the store shows"],
                    "note": "a store that shows no list price is not necessarily not discounting", "slug": "", "title": "markdowns"}
        else:
            key = f"market:new:{week[0]}-w{week[1]}"
            if key in ctx["used"]:
                continue
            rows = q(f"""select s.brand, count(*) from listing_first_seen l join sneakers s on s.id=l.sneaker_id
              where not l.is_baseline and l.first_seen>='{day}'::date-2 group by 1 order by 2 desc limit 5""")
            tot = q(f"select count(*) from listing_first_seen where not is_baseline and first_seen>='{day}'::date-2")
            if not rows or not tot or int(tot[0][0]) == 0:
                continue
            by = ", ".join(f"{b} {n}" for b, n in rows[:4])
            text = (f"New to our tracker in 2 days: {int(tot[0][0]):,} listings across Indian stores. Top brands: {by}. 'New' means first seen by us at that store, "
                    "not a launch date. Which brand should we track more of? Reply.")
            return {"label": "market: new listings", "text": clip(text, 275), "conf": "Reported", "ids": [key],
                    "sources": [f"Our own data (listing_first_seen), {day}; counts a pair once per store"],
                    "note": "not the same as new releases", "slug": "", "title": "new listings"}
    return None


def title_case(name):
    """'Nike AIR FORCE 1 '07' -> 'Nike Air Force 1 '07': brand as written, an all-capitals model in title case."""
    brand, _, model = name.partition(" ")
    return f"{brand} {model.title() if model.isupper() else model}".replace("'S", "'s").replace(" Og", " OG")


def k_wearing(day, ctx):
    stores = ",".join(f"'{s}'" for s in STORES)
    key = f"wearing:{datetime.date.fromisoformat(day).isocalendar()[1]}"
    if key in ctx["used"]:
        return None
    rows = q(f"""select s.brand||' '||s.model, count(distinct s.id) from sneakers s join sneaker_variants v on v.sneaker_id=s.id
      join price_snapshots ps on ps.sneaker_variant_id=v.id and ps.is_latest and ps.in_stock and ps.condition='new' and ps.currency='INR'
      join retailers r on r.id=ps.retailer_id and r.name in ({stores}) where s.gender in ('men','women','unisex') group by 1 order by 2 desc limit 5""")
    if len(rows) < 3:
        return None
    for n in range(len(rows), 2, -1):
        lst = ", ".join(f"{i + 1}. {clip(title_case(m), 28)} ({c})" for i, (m, c) in enumerate(rows[:n]))
        text = f"Stocked, not worn: the models Indian stores list in the most colourways today. {lst}. We have no data on what people wear. What is on your feet today? Reply with the pair."
        if x_len(text) <= LIMIT:
            return {"label": "wearing: what stores stock, and a question", "text": text, "conf": "Reported", "ids": [key],
                    "sources": [f"Our own data: pairs in stock at {', '.join(STORES)}, read {day}; counts colourways, not sales"],
                    "note": "stock is not wear; the replies are the real data, paste them into weekly.md", "slug": "", "title": "what you wear today"}
    return None


KINDS = {"reality": k_reality, "question": k_question, "random": k_random, "sale": k_sale, "drops": k_drops,
         "news": k_news, "controversy": k_bank("controversy"), "fact": k_bank("fact"), "market": k_market, "wearing": k_wearing, "collab": lambda day, ctx: k_news(day, ctx, True)}


TAGS = {"drops": "#SneakerReleases", "sale": "#SneakerDeals", "market": "#SneakerPrices", "controversy": "#SneakerNews", "fact": "#SneakerHistory",
        "news": "#SneakerNews", "collab": "#SneakerCollab", "wearing": "#SneakerCommunity", "random": "#SneakerCulture", "question": "#SneakerCommunity"}


def hashtags(kind, p):
    """At most two relevant tags, shown beside the post, not inside it: #SneakersIndia plus one for the kind (a reality post uses its shoe)."""
    if kind == "reality":
        words = re.sub(r"[^A-Za-z0-9 ]", "", p["title"]).split()
        second = "#" + "".join(w.capitalize() for w in words[:3]) if words else "#Sneakers"
    else:
        second = TAGS.get(kind, "#Sneakers")
    return ["#SneakersIndia", second]


def make_post(slot, kind, day, ctx):
    for k in (kind,) + tuple(x for x in FALLBACK[slot] if x != kind):
        p = KINDS[k](day, ctx)
        if p:
            ctx["used"].update(p["ids"])
            return dict(p, kind=k, wanted_kind=kind, tags=hashtags(k, p))
    return None


# ---- the file ------------------------------------------------------------------------------------------------

def block(text):
    n = x_len(text)
    warn = f"   <-- OVER THE {LIMIT} LIMIT by {n - LIMIT}: shorten before posting" if n > LIMIT else ""
    return ["```", text, "```", f"Length: {n}/{LIMIT}{warn}", ""]


def build(day):
    d = datetime.date.fromisoformat(day)
    ctx = {"facts": load_facts(), "used": recent_ids(day)}
    morning_kind, evening_kind = SLOTS[d.weekday()]
    today_drops = q(f"""select count(*) from drop_events where not hidden and not is_demo and release_date='{day}' and confirmation in ('confirmed','reported')""")
    new_today = bool(today_drops and int(today_drops[0][0]) > 0)
    if new_today and morning_kind != "drops":
        morning_kind = "drops"  # a new shoe releases today: it leads the day
    out = [f"# X posts for {day} ({d.strftime('%A')})", "",
           "Copy, paste, post yourself. Nothing here is posted automatically. The voice guide is `office/social/voice.md`. Re-check a price or date if it may have changed since this was written.", ""]
    packed = pack_entries(day)
    ids, pics = [], []
    for slot, kind, when in (("morning", morning_kind, "about 09:00 IST"), ("evening", evening_kind, "about 19:00 IST")):
        out += [f"## {slot.capitalize()} post ({when})", ""]
        if slot in packed and not (new_today and slot == "morning"):
            out += [f"Already scheduled from the weekly pack: **{packed[slot][0]}** (`{packed[slot][1]}`). Nothing to post from this draft; the text is in the `week-*.md` file.", ""]
            continue
        p = make_post(slot, kind, day, ctx)
        if not p:
            out += ["(nothing usable today: post a question of your own)", ""]
            continue
        out += [f"Type: **{p['label']}**" + (" (a new shoe releases today)" if new_today and slot == "morning" and p["kind"] == "drops" else "") + (f" (planned: {p['wanted_kind']}, nothing usable)" if p["kind"] != p["wanted_kind"] else ""), ""] + block(p["text"])
        tagged = x_len(p["text"] + "\n\n" + " ".join(p["tags"]))
        out += [f"Optional hashtags (at most two; add at the end if you want them): {' '.join(p['tags'])}  ->  with tags {tagged}/{LIMIT}"
                + ("   <-- too long with tags: leave them out or use one" if tagged > LIMIT else ""), ""]
        out += [f"Confidence: **{p['conf']}**  |  {p['note']}"]
        if p["sources"]:
            out += ["Sources (paste as a reply if you like):"] + [f"- {s}" for s in p["sources"]]
        out += [""]
        if p.get("picture"):
            out += [p["picture"], ""]
        ids += p["ids"]
        pics.append((slot, p["slug"], f"your own photo of {p['title']}" if p["slug"] else f"your own photo or the brand's press image (check rights) for: {clip(p['title'], 50)}"))
    if pics:
        out += ["## Pictures", ""] + social_images.status_lines(day, pics) + [""]
    out += ["## Rules we follow",
            "- Facts carry a source and a confidence line. Opinions say \"my take\".",
            "- Drop dates say confirmed / reported / rumoured, as on the site. A sale is a listing at a date, not a promise.",
            "- Headline and credit only, never publisher text. Reply to people who comment: that is the community.",
            "- We criticise products, prices and marketing, never people. Nothing is called fake or a scam without proof.", ""]
    out += [f"<!-- ids: {', '.join(ids)} -->"] + [f"<!-- picture: {s} | {g} | {w} -->" for s, g, w in pics]
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    ap.add_argument("--stdout", action="store_true")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # the Windows console default cannot print ₹
    text = build(a.date)
    if a.stdout:
        print(text)
        return
    POSTS.mkdir(parents=True, exist_ok=True)
    (POSTS / f"{a.date}.md").write_text(text, encoding="utf-8")
    print(f"wrote {POSTS / (a.date + '.md')}")


if __name__ == "__main__":
    main()
