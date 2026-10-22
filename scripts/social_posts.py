"""Daily X (Twitter) post drafts for CHOSN, in the critic voice (see office/social/voice.md).

Reads the fact bank (office/social/facts/*.md) and our own database (SELECT only, through docker exec psql)
and writes office/social/posts/<date>.md. It posts nothing: the founder copies the text.

Two posts a day, each within 280 characters as X counts them:
  Morning (about 09:00 IST): a "reality" post built from a fact-bank file: materials, construction, price in rupees from our scrape.
  Evening (about 19:00): a community question about the same shoe.
Optional extras in the same file: today's drops (how firm each date is) and the day's sneaker story (headline + credit only).
Every post lists its sources and a confidence line (Confirmed / Reported / Opinion). A post is not repeated within 30 days.

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
PG = ["docker", "exec", "chosn-postgres-1", "psql", "-U", "postgres", "-d", "chosn_dev", "-At", "-F", "|", "-c"]
SITE = os.environ.get("SOCIAL_SITE_URL", "").rstrip("/")
LIMIT = 280
REPEAT_DAYS = 30
FIRM = {"confirmed": "confirmed", "reported": "reported", "unconfirmed": "rumoured"}
# listing prices come from these stores only: resale stores would mix a different kind of price into the range
STORES = ("Myntra", "Ajio", "Flipkart", "Superkicks", "Puma India", "VegNonVeg")

QUESTIONS = [  # fallback when no fact file can be used; one per weekday, Monday first
    "What was your first pair that made you fall for sneakers? Reply with the pair.",
    "Which pair do you wear the most: the one you love or the one that is comfy? Be honest.",
    "A shoe you slept on and now regret? Tell us.",
    "Retro or new tech: what is your pick for daily wear?",
    "Weekend fit check: what are you putting on your feet? Drop a pic.",
    "One pair, any price, no resale: which would you grab?",
    "Sunday reset: what is the one pair you still want in 2026?",
]


def q(sql):
    r = subprocess.run(PG + [sql], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        sys.exit("database query failed: " + r.stderr.strip()[:300])
    return [line.split("|") for line in r.stdout.splitlines() if line]


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
    esc = lambda s: s.strip().replace("'", "''")
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
    rupees = lambda v: f"{v:,}"
    return text.replace("{min}", rupees(pr["min"])).replace("{med}", rupees(pr["med"])).replace("{max}", rupees(pr["max"])).replace("{n}", str(pr["n"]))


def recent_ids(day):
    """Ids of fact-bank posts and questions used in drafts of the previous REPEAT_DAYS days."""
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
    return used


def choose(day, facts):
    """Rotate through the fact bank by date; skip anything used in the last 30 days or without usable prices."""
    if not facts:
        return None
    used = recent_ids(day)
    start = datetime.date.fromisoformat(day).toordinal() % len(facts)
    for i in range(len(facts)):
        fct = facts[(start + i) % len(facts)]
        pr = prices(fct["db"])
        for p in fct["posts"]:
            if p["id"] in used:
                continue
            text = fill(p["text"], pr)
            if text is None:
                continue
            qs = [x for x in fct["questions"] if x["id"] not in used and fill(x["text"], pr)]
            question = dict(qs[0], text=fill(qs[0]["text"], pr)) if qs else None
            return {"fact": fct, "post": dict(p, text=text), "question": question, "prices": pr}
    return None


# ---- optional extras: drops and news (own data) -------------------------------------------------------------

def drops(day):
    return q(f"""select s.brand||' '||s.model||' '||s.colorway, d.release_date, d.confirmation, d.india_status,
        coalesce(d.retail_price::int::text,'')
      from drop_events d join sneakers s on s.id=d.sneaker_id
      where not d.hidden and not d.is_demo and d.release_date between '{day}' and '{day}'::date+7
      order by (d.release_date='{day}') desc, (d.confirmation='confirmed') desc, (d.confirmation='reported') desc,
        (d.india_status='confirmed_india') desc, d.release_date limit 12""")


def story(day):
    rows = q(f"""select title, source, coalesce(image_url,''), india::text from news_items
      where dup_of is null and not is_demo and published_at >= '{day}'::date - 1 and category is not null
      order by india desc, is_breaking desc, published_at desc limit 1""")
    return rows[0] if rows else None


def drops_note(day, rows):
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
    return text


def story_note(s):
    if not s:
        return None, ""
    title, source, img, india = s
    return f"{clip(title, 150)}\n(via {source})", img


# ---- the file ------------------------------------------------------------------------------------------------

def block(text):
    n = x_len(text)
    warn = f"   <-- OVER THE {LIMIT} LIMIT by {n - LIMIT}: shorten before posting" if n > LIMIT else ""
    return ["```", text, "```", f"Length: {n}/{LIMIT}{warn}", ""]


def build(day):
    d = datetime.date.fromisoformat(day)
    pick = choose(day, load_facts())
    out = [f"# X posts for {day}", "",
           "Copy, paste, post yourself. Nothing here is posted automatically. The voice guide is `office/social/voice.md`. Re-check a price or date if it may have changed since this was written.", ""]
    pics = []
    ids = []
    if pick:
        f, p, qn = pick["fact"], pick["post"], pick["question"]
        ids += [p["id"]] + ([qn["id"]] if qn else [])
        out += ["## Morning post (about 09:00 IST): reality", ""] + block(p["text"])
        out += [f"Confidence: **{p['conf']}**  |  fact file: `office/social/facts/{f['file']}` (checked {f['checked']})",
                "Sources (paste as a reply if you like):"] + [f"- {s}" for s in p["sources"]]
        if pick["prices"]:
            pr = pick["prices"]
            out += [f"- Our own data: {pr['n']} in-stock new listings at {', '.join(STORES)}, read {day}; listing prices, not MRP, mixed colourways"]
        out += [""]
        want = f"your own photo of the {f['title']}, side view with the tag or style code showing if you can"
        pics.append(("morning", f["slug"], want))
        if qn:
            out += ["## Evening post (about 19:00 IST): community question", ""] + block(qn["text"])
            out += ["Confidence: **Opinion** (a question, no claim).", ""]
            pics.append(("evening", f["slug"], want))
    else:
        out += ["## Morning post", "", "(no usable fact-bank post today: add facts or post a question)", ""]
        out += ["## Evening post (about 19:00 IST)", ""] + block(QUESTIONS[d.weekday()])

    extras = []
    dn = drops_note(day, drops(day))
    if dn:
        extras += ["### Drops note (own data; dates say confirmed / reported / rumoured)", ""] + block(dn)
    sn, img = story_note(story(day))
    if sn:
        extras += ["### Story of the day (headline + credit only; add your own line)", ""] + block(sn)
        if img:
            extras += [f"Picture to attach (credit the source): data/media{img[len('/media'):]}" if img.startswith("/media/") else f"Picture to attach (credit the source): {img}", ""]
    if extras:
        out += ["## Optional extras", ""] + extras

    if pics:
        out += ["## Pictures", ""] + social_images.status_lines(day, pics) + [""]
    out += ["## Rules we follow",
            "- Facts carry a source and a confidence line. Opinions say \"my take\".",
            "- Drop dates say confirmed / reported / rumoured, as on the site.",
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
