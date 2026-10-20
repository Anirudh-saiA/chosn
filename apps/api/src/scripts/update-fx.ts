/**
 * Daily exchange rate:  node --env-file=.env dist/scripts/update-fx.js
 * Reads the USD to INR reference rate (European Central Bank data, via the free Frankfurter API) so drops priced in dollars can be
 * shown in rupees. If the service is down the last stored rate keeps being used.
 */
import { Pool } from 'pg';

const CURRENCIES = ['USD', 'GBP'];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const cur of CURRENCIES) {
      try {
        const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${cur}&symbols=INR`, { headers: { 'User-Agent': 'CHOSN-price-compare/1.0' } });
        if (!res.ok) throw new Error(`rate service answered ${res.status}`);
        const d = (await res.json()) as { date?: string; rates?: { INR?: number } };
        const rate = d.rates?.INR;
        if (!rate || !d.date || !(rate > 30 && rate < 300)) throw new Error('unexpected rate payload');
        await pool.query(
          `INSERT INTO fx_rates (currency, rate_to_inr, source, updated_at) VALUES ($1, $2, $3, now())
           ON CONFLICT (currency) DO UPDATE SET rate_to_inr = EXCLUDED.rate_to_inr, source = EXCLUDED.source, updated_at = now()`,
          [cur, rate, `Frankfurter (ECB) ${d.date}`],
        );
        console.log(`[fx] ${cur}/INR ${rate} as of ${d.date}`);
      } catch (e) {
        const { rows } = await pool.query(`SELECT rate_to_inr, source FROM fx_rates WHERE currency = $1`, [cur]);
        console.log(`[fx] could not update ${cur} (${(e as Error).message}); keeping ${rows[0] ? `${rows[0].rate_to_inr} (${rows[0].source})` : 'nothing stored yet'}`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
