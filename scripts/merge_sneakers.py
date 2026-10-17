r"""Apply the report written by pair_products.py to the database, before the day's import.

    python scripts/merge_sneakers.py pair_report.json [--dry-run]

  1. Merges: two style codes that pair_products.py found to be the same shoe become one sneaker. Sizes, prices, price history
     and everything else attached to the old code move to the kept one (a size both have is folded together). The old code
     is deleted. Safe to run again: a code already merged is skipped.
  2. Names: sneakers that were saved with a Crepdog-style name ("adidas Handball Spezial Night Indigo") get the clean model
     and colour, so they group under the same model as the same shoe at other stores. Only names this script can prove it is
     replacing are touched (the stored name must still equal the original).

Needs Docker running with the CHOSN Postgres (container chosn-postgres-1, db chosn_dev, user postgres).
"""
import json
import subprocess
import sys

CONTAINER, DB, USER = "chosn-postgres-1", "chosn_dev", "postgres"


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def psql(sql):
    proc = subprocess.run(["docker", "exec", "-i", CONTAINER, "psql", "-U", USER, "-d", DB, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"],
                          input=sql, capture_output=True, text=True, encoding="utf-8")
    if proc.returncode != 0:
        raise SystemExit("psql failed:\n" + proc.stderr)
    return proc.stdout


MERGE_SQL = """
DO $$
DECLARE p record; fid uuid; tid uuid; v record; tv uuid; moved int := 0;
BEGIN
  FOR p IN SELECT * FROM (VALUES {pairs}) AS t(f, t) LOOP
    SELECT id INTO fid FROM sneakers WHERE style_code = p.f;
    SELECT id INTO tid FROM sneakers WHERE style_code = p.t;
    IF fid IS NULL THEN CONTINUE; END IF;
    IF tid IS NULL THEN
      UPDATE sneakers SET style_code = p.t WHERE id = fid;   -- nothing to merge into: just rename
      CONTINUE;
    END IF;
    FOR v IN SELECT * FROM sneaker_variants WHERE sneaker_id = fid LOOP
      SELECT id INTO tv FROM sneaker_variants WHERE sneaker_id = tid AND size = v.size AND size_system = v.size_system AND region = v.region;
      IF tv IS NULL THEN
        UPDATE sneaker_variants SET sneaker_id = tid WHERE id = v.id;
      ELSE
        UPDATE price_snapshots SET sneaker_variant_id = tv WHERE sneaker_variant_id = v.id;
        DELETE FROM market_summaries WHERE sneaker_variant_id = v.id;
        UPDATE manual_price_entries SET sneaker_variant_id = tv WHERE sneaker_variant_id = v.id;
        UPDATE posts SET sneaker_variant_id = tv WHERE sneaker_variant_id = v.id;
        UPDATE retailer_product_mappings SET sneaker_variant_id = tv WHERE sneaker_variant_id = v.id;
        DELETE FROM daily_best_prices d WHERE d.sneaker_variant_id = v.id
          AND EXISTS (SELECT 1 FROM daily_best_prices e WHERE e.sneaker_variant_id = tv AND e.day = d.day);
        UPDATE daily_best_prices SET sneaker_variant_id = tv WHERE sneaker_variant_id = v.id;
        DELETE FROM sneaker_variants WHERE id = v.id;
      END IF;
    END LOOP;
    UPDATE retailer_product_mappings SET sneaker_id = tid WHERE sneaker_id = fid;
    UPDATE drop_events SET sneaker_id = tid WHERE sneaker_id = fid;
    UPDATE sneakers t SET primary_image_url = COALESCE(t.primary_image_url, f.primary_image_url)
      FROM sneakers f WHERE t.id = tid AND f.id = fid;
    DELETE FROM sneakers WHERE id = fid;
    moved := moved + 1;
  END LOOP;
  RAISE NOTICE 'merged % sneaker(s)', moved;
END $$;
"""


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    report = json.load(open(args[0], encoding="utf-8"))
    merges = report.get("merges", [])
    fixes = report.get("name_fixes", {})

    if merges:
        pairs = ", ".join(f"({q(m['from'])}, {q(m['to'])})" for m in merges)
        sql = MERGE_SQL.format(pairs=pairs)
        print(f"{len(merges)} code merge(s) to apply" + (" (dry run, nothing changed)" if dry else ""))
        if not dry:
            psql(sql)
    if fixes:
        stmts = [
            f"UPDATE sneakers SET model = {q(v['model'])}, colorway = {q(v['colorway'])} "
            f"WHERE style_code = {q(code)} AND model = {q(v['from_model'])} AND colorway = {q(v['from_colorway'])};"
            for code, v in fixes.items()
        ]
        print(f"{len(stmts)} name fix(es) to apply" + (" (dry run, nothing changed)" if dry else ""))
        if not dry:
            for i in range(0, len(stmts), 200):
                psql("BEGIN;\n" + "\n".join(stmts[i : i + 200]) + "\nCOMMIT;")
    if not dry:
        n = psql("SELECT count(*) FROM sneakers;").strip()
        print(f"sneakers now: {n}")


if __name__ == "__main__":
    main()
