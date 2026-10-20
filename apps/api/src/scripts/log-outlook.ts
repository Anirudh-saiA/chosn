/**
 * Nightly outlook log + outcome check:  node --env-file=.env dist/scripts/log-outlook.js
 *
 *  1. LOG: score today's Buy now / Wait outlook for every shoe-size with 7+ days of price history plus a fixed 1-in-50 sample of the rest,
 *     and store it with the inputs (outlook_log). Safe to run twice in a day (one row per shoe-size per day).
 *  2. RESOLVE: for rows old enough, record what the best price did over the next 14 and 30 days (down 5%+, up 5%+, lowest, highest),
 *     read from daily_best_prices. A window needs at least 3 observed days to count.
 * Outcomes include moves caused by stock (a cheaper store selling out raises the best price), which is also what a shopper experiences.
 */
import { Pool } from 'pg';
import { scoreOutlook, type OutlookInput } from '../catalog/price-outlook';

const CHUNK = 1000;
const MAX_LOGGED = 60_000;

const bandOf = (p: number) => (p < 3000 ? 'under3k' : p < 6000 ? '3-6k' : p < 10000 ? '6-10k' : p < 20000 ? '10-20k' : '20k+');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: priorRows } = await pool.query('SELECT brand, band, n, drop_share, window_days FROM price_outlook_priors');
    const priors = new Map(priorRows.map((r) => [`${r.brand}|${r.band}`, { n: Number(r.n), dropShare: Number(r.drop_share), windowDays: Number(r.window_days) }]));
    const peerFor = (brand: string, price: number) => priors.get(`${brand}|${bandOf(price)}`) ?? priors.get(`*|${bandOf(price)}`) ?? priors.get('*|*') ?? null;

    const { rows: today } = await pool.query(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d`);
    const loggedOn: string = today[0].d;

    // Which shoe-sizes to keep in the log (history). Every in-stock shoe-size is scored for outlook_latest.
    const { rows: picked } = await pool.query(
      `WITH hist AS (SELECT sneaker_variant_id v FROM daily_best_prices WHERE day >= current_date - 90 GROUP BY 1 HAVING count(*) >= 7),
            live AS (SELECT DISTINCT sneaker_variant_id v FROM price_snapshots WHERE is_latest AND in_stock AND listing_url NOT LIKE '%FIXTURE%')
       SELECT l.v AS id FROM live l
        WHERE l.v IN (SELECT v FROM hist) OR mod(abs(hashtext(l.v::text)), 50) = 0
        LIMIT ${MAX_LOGGED}`,
    );
    const logSet = new Set<string>(picked.map((r) => r.id));
    const { rows: allLive } = await pool.query(`SELECT DISTINCT sneaker_variant_id AS id FROM price_snapshots WHERE is_latest AND in_stock AND listing_url NOT LIKE '%FIXTURE%'`);
    const ids: string[] = allLive.map((r) => r.id);
    let logged = 0;
    let latestWritten = 0;

    for (let k = 0; k < ids.length; k += CHUNK) {
      const chunk = ids.slice(k, k + CHUNK);
      const [snaps, hist, meta, sizes] = await Promise.all([
        pool.query(
          `SELECT ps.sneaker_variant_id AS v, r.slug, effective_price_inr(ps.price, ps.shipping_cost, ps.currency)::float AS price, ps.compare_at_price::float AS was
             FROM price_snapshots ps JOIN retailers r ON r.id = ps.retailer_id
            WHERE ps.sneaker_variant_id = ANY($1::uuid[]) AND ps.is_latest AND ps.in_stock AND ps.listing_url NOT LIKE '%FIXTURE%'`,
          [chunk],
        ),
        pool.query(
          `SELECT d.sneaker_variant_id AS v, d.day::text AS day, d.best_price_inr::float AS price, r.name AS store
             FROM daily_best_prices d LEFT JOIN retailers r ON r.id = d.best_retailer_id
            WHERE d.sneaker_variant_id = ANY($1::uuid[]) AND d.day >= current_date - 90 ORDER BY d.day`,
          [chunk],
        ),
        pool.query(`SELECT sv.id AS v, s.id AS sneaker_id, s.brand FROM sneaker_variants sv JOIN sneakers s ON s.id = sv.sneaker_id WHERE sv.id = ANY($1::uuid[])`, [chunk]),
        pool.query(
          `SELECT sv.sneaker_id, count(*)::int AS known,
                  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM price_snapshots ps WHERE ps.sneaker_variant_id = sv.id AND ps.is_latest AND ps.in_stock AND ps.listing_url NOT LIKE '%FIXTURE%'))::int AS in_stock
             FROM sneaker_variants sv WHERE sv.sneaker_id IN (SELECT sneaker_id FROM sneaker_variants WHERE id = ANY($1::uuid[])) GROUP BY sv.sneaker_id`,
          [chunk],
        ),
      ]);
      const snapBy = new Map<string, Array<{ slug: string; price: number; was: number | null }>>();
      for (const r of snaps.rows) snapBy.set(r.v, [...(snapBy.get(r.v) ?? []), { slug: r.slug, price: Number(r.price), was: r.was === null ? null : Number(r.was) }]);
      const histBy = new Map<string, Array<{ day: string; price: number; store: string | null }>>();
      for (const r of hist.rows) histBy.set(r.v, [...(histBy.get(r.v) ?? []), { day: r.day, price: Number(r.price), store: r.store }]);
      const metaBy = new Map(meta.rows.map((r) => [r.v, r]));
      const sizeBy = new Map(sizes.rows.map((r) => [r.sneaker_id, r]));

      const values: unknown[][] = [];
      const latest: unknown[][] = [];
      for (const id of chunk) {
        const m = metaBy.get(id);
        const live = snapBy.get(id) ?? [];
        if (!m || live.length === 0) continue;
        const best = live.reduce((a, b) => (b.price < a.price ? b : a));
        const sz = sizeBy.get(m.sneaker_id);
        const input: OutlookInput = {
          bestPrice: best.price,
          storePrices: live.map((x) => x.price),
          wasPrice: best.was,
          history: histBy.get(id) ?? [],
          storesInStock: new Set(live.map((x) => x.slug)).size,
          sizesInStock: sz?.in_stock ?? 0,
          sizesKnown: sz?.known ?? 0,
          peer: peerFor(m.brand, best.price),
          today: new Date(),
        };
        const o = scoreOutlook(input);
        latest.push([id, loggedOn, o.verdict, o.score, o.confidence]);
        if (logSet.has(id)) values.push([loggedOn, id, o.verdict, o.score, o.confidence, Math.round(best.price), o.historyDays, o.peerDropShare, JSON.stringify({ factors: o.factors.map((f) => [f.label, f.points]), stores: input.storePrices.length, was: input.wasPrice, sizes: [input.sizesInStock, input.sizesKnown], model: o.model })]);
      }
      if (latest.length) {
        const lp: unknown[] = [];
        const lt = latest.map((row, i) => {
          lp.push(...row);
          const b = i * 5;
          return `($${b + 1}::uuid,$${b + 2}::date,$${b + 3},$${b + 4},$${b + 5})`;
        });
        await pool.query(
          `INSERT INTO outlook_latest (sneaker_variant_id, computed_on, verdict, score, confidence) VALUES ${lt.join(',')}
           ON CONFLICT (sneaker_variant_id) DO UPDATE SET computed_on = EXCLUDED.computed_on, verdict = EXCLUDED.verdict, score = EXCLUDED.score, confidence = EXCLUDED.confidence`,
          lp,
        );
        latestWritten += latest.length;
      }
      if (values.length) {
        const params: unknown[] = [];
        const tuples = values.map((row, i) => {
          params.push(...row);
          const b = i * 9;
          return `($${b + 1}::date,$${b + 2}::uuid,$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9}::jsonb)`;
        });
        const res = await pool.query(
          `INSERT INTO outlook_log (logged_on, sneaker_variant_id, verdict, score, confidence, price, history_days, peer_drop_share, features) VALUES ${tuples.join(',')} ON CONFLICT (logged_on, sneaker_variant_id) DO NOTHING`,
          params,
        );
        logged += res.rowCount ?? 0;
      }
    }
    await pool.query(`DELETE FROM outlook_latest WHERE computed_on < $1::date`, [loggedOn]); // no longer in stock
    console.log(`[outlook] logged ${logged} new rows for ${loggedOn}; ${latestWritten} shoe-sizes scored into outlook_latest`);

    // Resolve outcomes
    for (const [h, col] of [[14, '14'], [30, '30']] as const) {
      const res = await pool.query(
        `WITH o AS (
           SELECT l.id, count(d.day) AS n, min(d.best_price_inr) AS lo, max(d.best_price_inr) AS hi, l.price
             FROM outlook_log l
             LEFT JOIN daily_best_prices d ON d.sneaker_variant_id = l.sneaker_variant_id AND d.day > l.logged_on AND d.day <= l.logged_on + ${h}
            WHERE l.resolved_${col}_at IS NULL AND l.logged_on <= (now() AT TIME ZONE 'Asia/Kolkata')::date - ${h}
            GROUP BY l.id, l.price)
         UPDATE outlook_log l SET days_seen_${col} = o.n, min_price_${col} = round(o.lo), max_price_${col} = round(o.hi),
                fell_5pct_${col} = CASE WHEN o.n >= 3 THEN o.lo <= o.price * 0.95 END,
                rose_5pct_${col} = CASE WHEN o.n >= 3 THEN o.hi >= o.price * 1.05 END,
                resolved_${col}_at = now()
           FROM o WHERE o.id = l.id`,
      );
      console.log(`[outlook] resolved ${res.rowCount ?? 0} rows at ${h} days`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
