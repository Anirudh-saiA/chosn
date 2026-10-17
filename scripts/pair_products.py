r"""Pair the same shoe across stores by model + colour, like a price-comparison site does.

    python scripts/pair_products.py merged.csv missing1.csv [missing2.csv ...] out.csv [--report report.json]

Why: the stores do not always give a style code, and Crepdog Crew writes the colour into the model name
("adidas Handball Spezial Night Indigo"). The importer keys shoes by style code, so without this step
  - every listing with no code was dropped (about 1,600 shoes never reached CHOSN), and
  - the same shoe at two stores stayed two shoes whenever their names differed.

What it does (nothing is guessed: a pair needs the same brand, the same model and the same colour, in the same order):
  1. Splits Crepdog-style names into model + colour, using the model names the other stores use as the dictionary.
  2. Gives every listing without a style code the code of the one coded shoe with the same brand + model + colour.
     If there is none, it gets a stable code N-<hash of brand|model|colour>, so the same shoe at another store (also without
     a code) lands on the same code tomorrow too.
  3. Two codes for the same brand + model + colour that no single store sells together are one shoe: they are merged under
     the code the most stores use. (A store that sells both codes proves they are different shoes: never merged.)
  4. Writes the merged CSV, and a report: merges to apply to the database (from_code -> to_code) and the corrected
     model / colour for shoes that were named the Crepdog way.
"""
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict

BRAND_PREFIX = {
    "adidas": {"adidas", "originals"},
    "on": {"on", "running"},
    "new balance": {"new", "balance"},
    "nike": {"nike"},
    "jordan": {"jordan", "air"},
    "asics": {"asics"},
    "puma": {"puma"},
    "converse": {"converse"},
    "saucony": {"saucony", "saucouny"},
    "reebok": {"reebok"},
    "vans": {"vans"},
    "hoka": {"hoka", "one"},
    "salomon": {"salomon"},
    "birkenstock": {"birkenstock"},
}
FLAGS = {"w": "w", "wmns": "w", "women": "w", "womens": "w", "gs": "k", "ps": "k", "td": "k", "kids": "k", "youth": "k", "jr": "k", "junior": "k"}
NOISE = {"the", "and", "men", "mens", "unisex", "shoes", "shoe", "sneakers", "sneaker", "footwear"}


BRAND_FIXES = {"adidas originals": "adidas", "air jordan": "jordan", "on running": "on", "new balance": "new balance"}


def canon_brand(b):
    return BRAND_FIXES.get((b or "").strip().lower(), (b or "").strip().lower())


def toks(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).split()


def split_flags(tokens):
    flag = ""
    out = []
    for t in tokens:
        if t in FLAGS:
            flag = FLAGS[t]
        elif t not in NOISE:
            out.append(t)
    return out, flag


def strip_brand(brand, tokens):
    drop = BRAND_PREFIX.get(canon_brand(brand), set(toks(brand)))
    i = 0
    # "air jordan 1": keep the model words when the brand prefix would eat them
    while i < len(tokens) - 1 and tokens[i] in drop and not (canon_brand(brand) == "jordan" and tokens[i] == "air" and i + 1 < len(tokens) and tokens[i + 1] != "jordan"):
        i += 1
    return tokens[i:]


def myntra_title(model, flag):
    """'Men Navy Solid Court Royale Sneakers' -> 'Navy Solid Court Royale'; women's pairs get ' (W)'."""
    t = re.sub(r"^(men|women|unisex|boys|girls|kids)\s+", "", model.strip(), flags=re.I)
    t = re.sub(r"\s+(casual |sports |running |training )?(sneakers?|shoes?)$", "", t, flags=re.I).strip() or model.strip()
    return t + (" (W)" if flag == "w" else "")


def title(tokens):
    return " ".join(t.upper() if len(t) <= 2 and not t.isalpha() else t.capitalize() for t in tokens)


def code_ok(c):
    return bool(c and c.strip())


def main():
    args = sys.argv[1:]
    report_path = None
    if "--report" in args:
        i = args.index("--report")
        report_path = args[i + 1]
        del args[i : i + 2]
    merged_path, out_path = args[0], args[-1]
    missing_paths = args[1:-1]

    rows = list(csv.DictReader(open(merged_path, encoding="utf-8")))
    cols = list(rows[0].keys())
    for p in missing_paths:
        extra = list(csv.DictReader(open(p, encoding="utf-8")))
        for r in extra:
            r.setdefault("delivery_time", "")
            rows.append(r)
    for c in ("delivery_time",):
        if c not in cols and any(c in r for r in rows):
            cols.append(c)
    for r in rows:
        r["style_code"] = (r.get("style_code") or "").strip().upper().replace(" ", "")
        r["brand"] = (r.get("brand") or "").strip()

    # ---- 1. model dictionary from the stores that write model and colour separately
    dictionary = defaultdict(Counter)  # brand_l -> {model tokens tuple: count}
    display = defaultdict(Counter)  # (brand_l, model tokens) -> raw model spelling
    for r in rows:
        if r["retailer"] == "Crepdog Crew" or not code_ok(r["style_code"]):
            continue
        mt, _ = split_flags(strip_brand(r["brand"], toks(r["model"])))
        if mt:
            dictionary[canon_brand(r["brand"])][tuple(mt)] += 1
            display[(canon_brand(r["brand"]), tuple(mt))][r["model"].strip()] += 1

    def split_name(r):
        """-> (model tokens, colour tokens, flag, display model, display colour)."""
        brand_l = canon_brand(r["brand"])
        name, flag = split_flags(strip_brand(r["brand"], toks(r["model"])))
        if r["retailer"] == "Myntra":  # "Men Air Force 1 '07 Casual Sneakers": drop the category words Myntra adds
            name = [t for t in name if t not in {"casual", "sports", "running", "training", "walking", "lifestyle"}] or name
        colour_raw = (r.get("colorway") or "").strip()
        if r["retailer"] == "Crepdog Crew":
            best = None
            for mt in dictionary.get(brand_l, ()):
                if len(mt) <= len(name) and tuple(name[: len(mt)]) == mt and (best is None or len(mt) > len(best)):
                    best = mt
            if best and len(name) > len(best):
                rest = name[len(best):]
                disp = display[(brand_l, best)].most_common(1)[0][0]
                return list(best), rest, flag, disp, title(rest)
            if best:
                disp = display[(brand_l, best)].most_common(1)[0][0]
                ct, cf = split_flags(toks(colour_raw))
                return list(best), ct, flag or cf, disp, colour_raw
        ct, cf = split_flags(toks(colour_raw))
        if r["retailer"] == "Myntra":
            return name, ct, flag or cf, myntra_title(r["model"], flag or cf), colour_raw
        return name, ct, flag or cf, r["model"].strip(), colour_raw

    parsed = []
    for r in rows:
        mt, ct, flag, dm, dc = split_name(r)
        key = (canon_brand(r["brand"]), " ".join(mt), flag, " ".join(ct))
        parsed.append((r, key, dm, dc))

    # ---- 2/3. entity table: key -> {code -> stores}
    # A code whose listings do not all describe one shoe (stores disagree about what it is) is left alone: never merged into,
    # never used to pair a no-code listing.
    code_keys = defaultdict(set)
    for r, key, _, _ in parsed:
        if code_ok(r["style_code"]) and key[1] and key[3]:
            code_keys[r["style_code"]].add(key)
    by_key = defaultdict(lambda: defaultdict(set))
    for r, key, _, _ in parsed:
        if code_ok(r["style_code"]) and key[1] and key[3] and len(code_keys[r["style_code"]]) == 1:
            by_key[key][r["style_code"]].add(r["retailer"])

    code_alias = {}
    merges = []
    # The same code spelled two ways ("IH6-591" / "IH6591") is one shoe, whatever the names say.
    spellings = defaultdict(Counter)
    for r, _, _, _ in parsed:
        if code_ok(r["style_code"]):
            spellings[re.sub(r"[^A-Z0-9]", "", r["style_code"])][r["style_code"]] += 1
    for variants in spellings.values():
        if len(variants) > 1:
            keep = max(variants, key=lambda c: (variants[c], c))
            for c in variants:
                if c != keep:
                    code_alias[c] = keep
                    merges.append({"from": c, "to": keep, "model": "(same code, different spelling)", "colour": ""})
    for key, codes in by_key.items():
        if len(codes) < 2:
            continue
        # one store selling two codes of this key proves they are different shoes
        stores = [s for st in codes.values() for s in st]
        if len(stores) != len(set(stores)):
            continue
        keep = max(codes, key=lambda c: (len(codes[c]), -len(c), c))
        for c in codes:
            if c == keep:
                continue
            # Same brand + model + colour is not enough on its own (a different model can share a name), so the codes must also
            # start alike: "IH6-591" / "IH6591", New Balance "U9060IRD" / "U90609MA".
            if c in code_alias:
                continue
            alike = re.sub(r"[^A-Z0-9]", "", c)[:5] == re.sub(r"[^A-Z0-9]", "", keep)[:5]
            if alike:
                code_alias[c] = keep
                merges.append({"from": c, "to": keep, "model": key[1], "colour": key[3]})

    def pick_code(key):
        codes = by_key.get(key)
        if codes:
            return max(codes, key=lambda c: (len(codes[c]), c))  # the alias target is the most-used code
        return "N-" + hashlib.sha1("|".join(key).encode("utf-8")).hexdigest()[:9].upper()

    out_rows, assigned, paired, synthetic = [], 0, 0, 0
    name_fixes = {}
    for r, key, dm, dc in parsed:
        code = r["style_code"]
        if not code_ok(code):
            if not (key[1] and key[3]):
                continue  # not enough to identify the shoe: skip rather than guess
            code = pick_code(key)
            assigned += 1
            if code.startswith("N-"):
                synthetic += 1
            else:
                paired += 1
        elif code in code_alias:
            code = code_alias[code]
        if r["retailer"] in ("Crepdog Crew", "Myntra") and (dm != r["model"].strip() or dc != (r.get("colorway") or "").strip()):
            name_fixes.setdefault(code, (dm, dc, r["model"].strip(), (r.get("colorway") or "").strip()))
            r["model"], r["colorway"] = dm, dc
        r["style_code"] = code
        out_rows.append(r)

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(out_rows)

    report = {"merges": merges, "name_fixes": {k: {"model": v[0], "colorway": v[1], "from_model": v[2], "from_colorway": v[3]} for k, v in name_fixes.items()},
              "assigned": assigned, "paired_with_existing_code": paired, "new_n_codes": synthetic}
    if report_path:
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=1)
    print(f"{len(rows)} rows in, {len(out_rows)} out. No-code listings given a code: {assigned} "
          f"({paired} paired with a coded shoe, {synthetic} on new N- codes). Same-shoe code merges: {len(merges)}. Names fixed: {len(name_fixes)}.")


if __name__ == "__main__":
    main()
