r"""Work out each store's Trust score from the collected signals, and save it with the working shown.

    python scripts/trust/compute_trust.py [--dry-run]

THE FORMULA (0-100, higher is better). Four parts, each 0 to 1:

  Reviews     45%  Rating, adjusted for how many ratings stand behind it (a Bayesian average: 100 imaginary ratings of 3.8 stars are
                   mixed in, so 20 ratings cannot outweigh 20,000), then scaled so 3 stars = 0 and 5 stars = 1. A rating the store or
                   platform publishes about itself is trusted at 70% (it is pulled 30% of the way back to neutral); a rating from an
                   independent source (Google) counts in full. Fewer than 10 ratings: no reviews part.
  Standing    20%  Only from cited sources (scripts/trust/curated.json): the brand's own store = 1.0; otherwise 0.4 + 0.15 per independent
                   news article about the store (at most 0.85).
  Returns     20%  The store's own stated returns rule: accepted 1, limited 0.5, none 0.
  Clarity     15%  Of delivery time, returns rule, shipping cost and payment methods, the share the store states.

A part with no evidence is NEUTRAL (0.5), never zero: not having looked is not a mark against a store. Policy parts (Returns, Clarity) are
left neutral for a store whose policy pages we have not recorded (for example because its robots.txt forbids reading them).
So the score is 100 x the weighted sum of the four parts. Confidence says how much of it is evidence:
  high    ratings from an independent source (150+), plus at least one other cited part
  medium  ratings of any kind (50+), or cited standing
  low     everything else (the score is mostly neutral and is shown as such)
"""
import datetime
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SIGNALS = os.path.join(ROOT, "data", "trust", "signals.json")
CURATED = os.path.join(ROOT, "scripts", "trust", "curated.json")
W = {"reviews": 0.45, "standing": 0.20, "returns": 0.20, "clarity": 0.15}
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


def score_store(slug, f, sig, cur):
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
    curated = json.load(open(CURATED, encoding="utf-8"))
    sql = []
    for slug, f in sorted(facts().items()):
        score, conf, detail = score_store(slug, f, signals.get(slug), curated.get(slug))
        print(f"{slug:24} trust {score:3}  confidence {conf:6}  parts {detail['parts']}")
        detail["formula"] = "reviews 45% / standing 20% / returns 20% / clarity 15%; a part with no evidence is neutral"
        detail["computed"] = datetime.date.today().isoformat()
        blob = json.dumps(detail).replace("'", "''")
        sql.append(f"UPDATE retailers SET trust_score = {score}, trust_confidence = '{conf}', trust_detail = '{blob}'::jsonb, trust_updated_at = now() WHERE slug = '{slug}';")
    if not dry:
        psql("\n".join(sql), fetch=False)
        print("saved")
    return 0


if __name__ == "__main__":
    sys.exit(main())
