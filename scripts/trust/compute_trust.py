r"""Work out each store's Trust score from the collected signals, and save it with the working shown.

    python scripts/trust/compute_trust.py [--dry-run]

THE FORMULA (0-100, higher is better). Five parts, each 0 to 1:

  Reviews     40%  Rating, adjusted for how many ratings stand behind it (a Bayesian average: 100 imaginary ratings of 3.8 stars are
                   mixed in, so 20 ratings cannot outweigh 20,000), then scaled so 3 stars = 0 and 5 stars = 1. A rating the store or
                   platform publishes about itself is trusted at 70% (it is pulled 30% of the way back to neutral); a rating from an
                   independent source (Google) counts in full. Fewer than 10 ratings: no reviews part.
  Standing    15%  Only from cited sources (scripts/trust/curated.json): the brand's own store = 1.0; otherwise 0.4 + 0.15 per independent
                   news article about the store (at most 0.85).
  Returns     15%  The store's own stated returns rule: accepted 1, limited 0.5, none 0.
  Clarity     10%  Of delivery time, returns rule, shipping cost and payment methods, the share the store states.
  Business    20%  Is a real business behind the site? (scripts/trust/business_checks.py) Domain age (30%: 5+ years = full, newer scales
                   down), a well-formed GST number shown (25%), a company name / CIN / registered address shown (15%), a support phone or
                   e-mail (10%), returns / privacy / terms pages linked (10%), HTTPS (10%). Something we could not find on the public pages
                   counts 0.3 (it may sit behind a script we do not run); a site we are not allowed to read is unknown, so neutral.

A part with no evidence is NEUTRAL (0.5), never zero: not having looked is not a mark against a store. Policy parts (Returns, Clarity) are
left neutral for a store whose policy pages we have not recorded (for example because its robots.txt forbids reading them).
So the score is 100 x the weighted sum of the four parts. Confidence says how much of it is evidence:
  high    ratings from an independent source (150+), plus at least one other cited part
  medium  ratings of any kind (50+), or cited standing. (Business checks raise the score but never the confidence: they show a real
          business exists, not how buyers were treated.)
  low     everything else. The site shows "Not enough evidence yet" for these instead of a number (the provisional number stays in the
          working), so a store nobody has researched is not ranked beside one we know.
"""
import datetime
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SIGNALS = os.path.join(ROOT, "data", "trust", "signals.json")
BUSINESS = os.path.join(ROOT, "data", "trust", "business.json")
CURATED = os.path.join(ROOT, "scripts", "trust", "curated.json")
W = {"reviews": 0.40, "standing": 0.15, "returns": 0.15, "clarity": 0.10, "business": 0.20}
PRIOR_N, PRIOR_R, SELF_PUBLISHED = 100, 3.8, 0.7
clamp = lambda x: max(0.0, min(1.0, x))  # noqa: E731


def psql(sql, fetch=True):
    cmd = ["docker", "exec", "-i", "chosn-postgres-1", "psql", "-U", "postgres", "-d", "chosn_dev", "-t", "-A", "-F", "|"]
    out = subprocess.run(cmd, input=sql, capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        raise RuntimeError(out.stderr[:400])
    return [line.split("|") for line in out.stdout.strip().splitlines() if line] if fetch else None


def facts():
    rows = psql("""select slug, returns_tone, (delivery_min_days is not null)::int, (returns_note is not null)::int, (shipping_note is not null)::int,
                          ((payment_methods is not null and cardinality(payment_methods) > 0) or jsonb_array_length(coalesce(payment_options,'[]'::jsonb)) > 0)::int
                   from retailers where status = 'active'""")
    return {r[0]: {"tone": r[1] or None, "delivery": int(r[2]), "returns": int(r[3]), "shipping": int(r[4]), "payments": int(r[5])} for r in rows}


def business_part(b):
    """(score 0-1, checks passed of 6, reasons) from business_checks.py output; (None, 0, []) when unreadable or not checked."""
    if not b or b.get("unreadable") or b.get("error") or "gstin" not in b:
        return None, 0, ["Business basics: the site's pages could not be read (robots.txt, or built by scripts), so neutral (50/100)"]
    # A page set with neither a company name nor any contact detail is almost always built by scripts we do not run (an older check
    # recorded these as "not found"): treat it as unreadable, not as a failure.
    if not b["company"]["named_or_address"] and not (b["contact"]["phone"] or b["contact"]["email"]):
        return None, 0, ["Business basics: the page text we can read has no contact or company details at all (likely built by scripts), so neutral (50/100)"]
    NOT_FOUND = 0.3
    age = b.get("domain_age_years")
    age_s = None if age is None else (1.0 if age >= 5 else 0.7 if age >= 2 else 0.4 if age >= 1 else 0.15)
    gst_ok = bool(b["gstin"]["valid"])
    comp_ok = bool(b["company"]["named_or_address"])
    cont_ok = bool(b["contact"]["phone"] or b["contact"]["email"])
    pol = b["policies"]
    pol_ok = sum(1 for k in ("returns", "privacy", "terms") if pol.get(k)) >= 2
    https_ok = bool(b.get("https"))
    items = [
        (0.30, age_s if age_s is not None else 0.5, f"domain registered {b.get('domain_registered')} ({age} years)" if age is not None else "domain age not readable (neutral)"),
        (0.25, 1.0 if gst_ok else NOT_FOUND, f"GST number shown and well-formed ({b['gstin']['valid'][0]})" if gst_ok else "no well-formed GST number found on the pages we read"),
        (0.15, 1.0 if comp_ok else NOT_FOUND, "company name or registered address shown" if comp_ok else "no company name or registered address found"),
        (0.10, 1.0 if cont_ok else NOT_FOUND, "support phone or e-mail shown" if cont_ok else "no support phone or e-mail found"),
        (0.10, 1.0 if pol_ok else NOT_FOUND, "returns / privacy / terms pages linked" if pol_ok else "fewer than two of returns / privacy / terms pages linked"),
        (0.10, 1.0 if https_ok else NOT_FOUND, "served over HTTPS" if https_ok else "not confirmed over HTTPS"),
    ]
    score = sum(w * v for w, v, _ in items)
    passed = int(age_s is not None and age_s >= 0.7) + int(gst_ok) + int(comp_ok) + int(cont_ok) + int(pol_ok) + int(https_ok)
    return score, passed, [f"Business basics: {round(score * 100)}/100"] + [f"   - {t}" for _, _, t in items]


def score_store(slug, f, sig, cur, biz=None):
    parts, why = {}, []
    # Reviews
    reviews = None
    if sig and sig["count"] >= 10:
        n, r = sig["count"], sig["rating"]
        adj = (n * r + PRIOR_N * PRIOR_R) / (n + PRIOR_N)
        raw = clamp((adj - 3) / 2)
        independent = "Google" in sig["source"]
        reviews = raw if independent else 0.5 + SELF_PUBLISHED * (raw - 0.5)
        why.append(f"Reviews: {r:.2f} stars from {n:,} ratings ({sig['sample']}; {'independent' if independent else 'published by the store or platform itself'}) = {round(reviews * 100)}/100")
    else:
        why.append("Reviews: none we can read, so neutral (50/100)")
    parts["reviews"] = 0.5 if reviews is None else reviews
    # Standing
    standing = None
    if cur:
        if cur.get("type") == "official_brand_store":
            standing = 1.0
        elif cur.get("independent_articles"):
            standing = min(0.85, 0.4 + 0.15 * cur["independent_articles"])
        why.append(f"Standing: {cur['summary']} = {round((standing if standing is not None else 0.5) * 100)}/100")
    else:
        why.append("Standing: nothing cited yet, so neutral (50/100)")
    parts["standing"] = 0.5 if standing is None else standing
    # Policies: only when we have recorded something about this store's policies.
    recorded = f["delivery"] or f["returns"] or f["shipping"] or f["payments"] or f["tone"]
    if recorded:
        tone = {"ok": 1.0, "limited": 0.5, "none": 0.0}.get(f["tone"] or "", 0.5)
        stated = (f["delivery"] + f["returns"] + f["shipping"] + f["payments"]) / 4
        parts["returns"], parts["clarity"] = tone, stated
        why.append(f"Returns: {f['tone'] or 'not stated'} = {round(tone * 100)}/100")
        why.append(f"Clarity: states {f['delivery'] + f['returns'] + f['shipping'] + f['payments']} of 4 (delivery, returns, shipping, payments) = {round(stated * 100)}/100")
    else:
        parts["returns"] = parts["clarity"] = 0.5
        why.append("Returns and clarity: policy pages not recorded, so neutral (50/100)")
    b_score, b_passed, b_why = business_part(biz)
    parts["business"] = 0.5 if b_score is None else b_score
    why.extend(b_why)
    score = round(100 * sum(W[k] * parts[k] for k in W))
    independent_n = bool(sig and "Google" in sig["source"] and sig["count"] >= 150)
    if independent_n and (standing is not None or recorded):
        conf = "high"
    elif (sig and sig["count"] >= 50) or standing is not None:
        conf = "medium"
    else:
        conf = "low"
    return score, conf, {"parts": {k: round(v * 100) for k, v in parts.items()}, "why": why, "sources": (cur or {}).get("sources", []) + ([{"title": sig["source"], "url": sig["url"]}] if sig else [])}


def main():
    dry = "--dry-run" in sys.argv
    signals = json.load(open(SIGNALS, encoding="utf-8")) if os.path.exists(SIGNALS) else {}
    business = json.load(open(BUSINESS, encoding="utf-8")) if os.path.exists(BUSINESS) else {}
    curated = json.load(open(CURATED, encoding="utf-8"))
    sql = []
    for slug, f in sorted(facts().items()):
        score, conf, detail = score_store(slug, f, signals.get(slug), curated.get(slug), business.get(slug))
        print(f"{slug:24} trust {score:3}  confidence {conf:6}  parts {detail['parts']}")
        detail["formula"] = "reviews 40% / business basics 20% / standing 15% / returns 15% / clarity 10%; a part with no evidence is neutral"
        detail["computed"] = datetime.date.today().isoformat()
        blob = json.dumps(detail).replace("'", "''")
        sql.append(f"UPDATE retailers SET trust_score = {score}, trust_confidence = '{conf}', trust_detail = '{blob}'::jsonb, trust_updated_at = now() WHERE slug = '{slug}';")
    if not dry:
        psql("\n".join(sql), fetch=False)
        print("saved")
    return 0


if __name__ == "__main__":
    sys.exit(main())
