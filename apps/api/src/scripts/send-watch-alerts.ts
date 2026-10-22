/**
 * Wishlist alerts, run after the nightly import:  node --env-file=.env dist/scripts/send-watch-alerts.js
 *
 *  1. For every hearted shoe + size, read today's state (in stock anywhere? cheapest in-stock price and store).
 *  2. Compare with the state seen last time. Write bell-inbox alerts for: a size back in stock, a price drop of 3% / Rs 100 or more,
 *     a target price reached, and a size gone out of stock. The first time a shoe is seen only its state is stored - no alert.
 *  3. E-mail unsent alerts (not "sold out") to watches with a confirmed address that left instant mail on.
 *  4. Once a week send a digest of every watched shoe, including "no change", to watches that left the weekly mail on.
 * Without RESEND_API_KEY the alerts still land in the inbox; mail is skipped.
 */
import { Pool } from 'pg';
import { EmailService } from '../email/email.service';

const WEB = (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const API = (process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

interface Item {
  watch_id: string;
  style_code: string;
  size: string | null;
  target_price: number | null;
  last_in_stock: boolean | null;
  last_price: number | null;
  name: string;
}
interface State {
  inStock: boolean;
  price: number | null;
  store: string | null;
}

async function stateOf(pool: Pool, style: string, size: string | null): Promise<State> {
  const { rows } = await pool.query(
    `SELECT effective_price_inr(ps.price, ps.shipping_cost, ps.currency)::int AS price, r.name
       FROM price_snapshots ps
       JOIN sneaker_variants v ON v.id = ps.sneaker_variant_id
       JOIN sneakers s ON s.id = v.sneaker_id
       JOIN retailers r ON r.id = ps.retailer_id
      WHERE s.style_code = $1 AND ($2::numeric IS NULL OR v.size = $2::numeric)
        AND ps.is_latest AND ps.in_stock AND ps.listing_url NOT LIKE '%FIXTURE%'
      ORDER BY 1 ASC NULLS LAST LIMIT 1`,
    [style, size],
  );
  return rows[0] ? { inStock: true, price: rows[0].price, store: rows[0].name } : { inStock: false, price: null, store: null };
}

function link(i: { style_code: string; size: string | null }): string {
  return `${WEB}/sneakers/${encodeURIComponent(i.style_code)}/${i.size ?? ''}`;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const email = new EmailService();
  try {
    const { rows: items } = await pool.query<Item>(
      `SELECT wi.watch_id, wi.style_code, wi.size, wi.target_price, wi.last_in_stock, wi.last_price,
              trim(s.brand || ' ' || s.model || ' ' || s.colorway) AS name
         FROM watch_items wi JOIN sneakers s ON s.style_code = wi.style_code`,
    );
    const cache = new Map<string, State>();
    const now = new Map<string, State>();
    let made = 0;
    for (const it of items) {
      const key = `${it.style_code}|${it.size ?? ''}`;
      let st = cache.get(key);
      if (!st) cache.set(key, (st = await stateOf(pool, it.style_code, it.size)));
      now.set(`${it.watch_id}|${key}`, st);
      const sizeTxt = it.size ? `UK ${Number(it.size)}` : 'your size';
      const out: Array<{ kind: string; message: string }> = [];
      if (it.last_in_stock !== null) {
        if (!it.last_in_stock && st.inStock) out.push({ kind: 'back_in_stock', message: `${it.name} (${sizeTxt}) is back in stock${st.store ? ` at ${st.store}` : ''}${st.price ? ` from ${inr(st.price)}` : ''}.` });
        else if (it.last_in_stock && !st.inStock) out.push({ kind: 'sold_out', message: `${it.name} (${sizeTxt}) is sold out everywhere we track.` });
      }
      if (st.price !== null && it.last_price !== null && st.price <= it.last_price - Math.max(100, it.last_price * 0.03) && !(it.target_price && st.price <= it.target_price)) {
        out.push({ kind: 'price_drop', message: `${it.name} (${sizeTxt}) dropped from ${inr(it.last_price)} to ${inr(st.price)}${st.store ? ` at ${st.store}` : ''}.` });
      }
      if (it.target_price && st.price !== null && st.price <= it.target_price && (it.last_price === null || it.last_price > it.target_price || it.last_in_stock === false)) {
        out.push({ kind: 'target_reached', message: `${it.name} (${sizeTxt}) reached your target: ${inr(st.price)}${st.store ? ` at ${st.store}` : ''} (you wanted ${inr(it.target_price)} or less).` });
      }
      for (const a of out) {
        await pool.query(`INSERT INTO watch_alerts (watch_id, style_code, size, kind, message, price, store) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [it.watch_id, it.style_code, it.size, a.kind, a.message, st.price, st.store]);
        made++;
      }
      await pool.query(`UPDATE watch_items SET last_in_stock = $3, last_price = $4 WHERE watch_id = $1 AND style_code = $2`, [it.watch_id, it.style_code, st.inStock, st.price]);
    }
    console.log(`[watch] ${items.length} watched shoes checked, ${made} new alerts`);

    // Instant mail
    let sent = 0;
    const { rows: due } = await pool.query(
      `SELECT w.id, w.email, w.unsubscribe_token FROM watches w
        WHERE w.email_confirmed AND w.email IS NOT NULL AND w.email_instant
          AND EXISTS (SELECT 1 FROM watch_alerts a WHERE a.watch_id = w.id AND a.emailed_at IS NULL AND a.kind <> 'sold_out')`,
    );
    for (const w of due) {
      const { rows: al } = await pool.query(`SELECT id, style_code, size, message FROM watch_alerts WHERE watch_id = $1 AND emailed_at IS NULL AND kind <> 'sold_out' ORDER BY id`, [w.id]);
      const unsub = `${API}/watch/unsubscribe?token=${w.unsubscribe_token}`;
      const html = `<p>Good news from your CHOSN wishlist:</p><ul>${al.map((a) => `<li><a href="${link(a)}">${esc(a.message)}</a></li>`).join('')}</ul><p style="color:#666;font-size:12px"><a href="${unsub}">Unsubscribe</a> from wishlist e-mails.</p>`;
      const text = `Good news from your CHOSN wishlist:\n${al.map((a) => `- ${a.message} ${link(a)}`).join('\n')}\nUnsubscribe: ${unsub}`;
      if (await email.sendMail(w.email, al.length === 1 ? al[0].message.slice(0, 80) : `${al.length} updates on your CHOSN wishlist`, html, text, unsub)) {
        await pool.query(`UPDATE watch_alerts SET emailed_at = now() WHERE id = ANY($1::bigint[])`, [al.map((a) => a.id)]);
        sent++;
      }
    }

    // Weekly digest
    let digests = 0;
    const { rows: weekly } = await pool.query(
      `SELECT w.id, w.email, w.unsubscribe_token FROM watches w
        WHERE w.email_confirmed AND w.email IS NOT NULL AND w.email_weekly AND (w.last_digest_at IS NULL OR w.last_digest_at < now() - interval '6 days 12 hours')
          AND EXISTS (SELECT 1 FROM watch_items i WHERE i.watch_id = w.id)`,
    );
    for (const w of weekly) {
      const mine = items.filter((i) => i.watch_id === w.id);
      const lines = mine.map((i) => {
        const st = now.get(`${w.id}|${i.style_code}|${i.size ?? ''}`)!;
        const sizeTxt = i.size ? `UK ${Number(i.size)}` : 'any size';
        const status = st.inStock ? `in stock from ${inr(st.price!)}${st.store ? ` at ${st.store}` : ''}` : 'not available right now';
        const move = st.price !== null && i.last_price !== null && st.price !== i.last_price ? (st.price < i.last_price ? ' (cheaper than before)' : ' (pricier than before)') : ' (no change)';
        return { i, text: `${i.name}, ${sizeTxt}: ${status}${st.inStock ? move : ''}` };
      });
      const unsub = `${API}/watch/unsubscribe?token=${w.unsubscribe_token}`;
      const html = `<p>Your CHOSN wishlist this week:</p><ul>${lines.map((l) => `<li><a href="${link(l.i)}">${esc(l.text)}</a></li>`).join('')}</ul><p style="color:#666;font-size:12px"><a href="${unsub}">Unsubscribe</a> from wishlist e-mails.</p>`;
      const text = `Your CHOSN wishlist this week:\n${lines.map((l) => `- ${l.text} ${link(l.i)}`).join('\n')}\nUnsubscribe: ${unsub}`;
      if (await email.sendMail(w.email, 'Your CHOSN wishlist this week', html, text, unsub)) {
        await pool.query(`UPDATE watches SET last_digest_at = now() WHERE id = $1`, [w.id]);
        digests++;
      }
    }
    console.log(`[watch] ${sent} alert mails, ${digests} weekly digests${email.enabled ? '' : ' (RESEND_API_KEY not set: mail skipped)'}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
