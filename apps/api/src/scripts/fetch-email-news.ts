/**
 * News from a mailbox CHOSN owns (newsletters and alerts):  node --env-file=.env dist/scripts/fetch-email-news.js [--discover]
 *
 * Reads recent mail over IMAP from ONE dedicated mailbox (never a personal one) and turns the mail from allow-listed senders into news items:
 *   - Google Alerts: one item per result, linking straight to the publisher's article (Google's redirect is unwrapped).
 *   - Brand and store newsletters: one item per email that announces something (a drop, launch, collab, restock). Pure sale and discount
 *     mail is skipped.
 *
 * Rules that keep this safe and permitted:
 *   - Only senders on the allow-list below are read. Everything else is ignored, so spam and strangers cannot put text on the site.
 *   - A message is only used when the receiving mail server recorded a DMARC pass, or an SPF or DKIM pass for the same domain as the From
 *     address (not just any domain), so a forged From line is ignored.
 *   - Mail is untrusted input: only plain text is kept, cut to a 180 character excerpt, with the subject as the headline.
 *   - A newsletter's own "view in browser" link is NEVER stored: those links usually carry a token that identifies the subscribed mailbox.
 *     The "Read at" link goes to the brand's public site instead, with a harmless #mail-<hash> fragment so each email stays unique.
 *   - Nothing in the mailbox is changed (no deletes, no flags). Duplicates are handled by the unique source_url, same as the other fetchers.
 *   - --discover prints who has been writing to the mailbox and does not touch the database. Use it after subscribing to add senders below.
 *
 * Needs (all optional; the script says what is missing and exits cleanly):
 *   NEWS_IMAP_USER, NEWS_IMAP_PASSWORD (an app password, not the account password), NEWS_IMAP_HOST (default imap.gmail.com),
 *   NEWS_IMAP_FOLDER (default INBOX). Packages: imapflow and mailparser (+ @types/mailparser) in apps/api.
 */
import { createHash } from 'node:crypto';

const MAX_AGE_DAYS = 14;
const MAX_MESSAGES = 300;

export interface Sender {
  /** Shown as the source, e.g. "Superkicks newsletter". */
  name: string;
  /** Matches when the sender's address domain equals or ends with one of these. */
  domains: string[];
  /** The brand's public page that the "Read at" link points to. */
  homeUrl: string;
  region: 'global' | 'india';
}

/**
 * Newsletter senders. The domains are best guesses of each brand's mail domain and must be confirmed with --discover after the first emails
 * arrive; a brand that sends from an unlisted domain is simply not read until it is added.
 */
export const SENDERS: Sender[] = [
  { name: 'Nike', domains: ['nike.com'], homeUrl: 'https://www.nike.com/in/launch', region: 'global' },
  { name: 'adidas', domains: ['adidas.com', 'adidas.co.in'], homeUrl: 'https://www.adidas.co.in/', region: 'global' },
  { name: 'PUMA', domains: ['puma.com'], homeUrl: 'https://in.puma.com/', region: 'global' },
  { name: 'New Balance', domains: ['newbalance.com', 'newbalance.co.in'], homeUrl: 'https://www.newbalance.co.in/', region: 'global' },
  { name: 'ASICS', domains: ['asics.com'], homeUrl: 'https://www.asics.com/in/en-in/', region: 'global' },
  { name: 'Superkicks', domains: ['superkicks.in'], homeUrl: 'https://www.superkicks.in/', region: 'india' },
  { name: 'Crepdog Crew', domains: ['crepdogcrew.com'], homeUrl: 'https://crepdogcrew.com/', region: 'india' },
  { name: 'Limited Edt', domains: ['limitededt.in'], homeUrl: 'https://limitededt.in/', region: 'india' },
  { name: 'Culture Circle', domains: ['culturecircle.com'], homeUrl: 'https://culturecircle.com/', region: 'india' },
  { name: 'Mainstreet Marketplace', domains: ['mainstreetmarketplace.in'], homeUrl: 'https://mainstreetmarketplace.in/', region: 'india' },
  { name: 'Comet', domains: ['wearcomet.com'], homeUrl: 'https://www.wearcomet.com/', region: 'india' },
  { name: 'Gully Labs', domains: ['gullylabs.com'], homeUrl: 'https://gullylabs.com/', region: 'india' },
  { name: 'Thaely', domains: ['thaely.com'], homeUrl: 'https://thaely.com/', region: 'india' },
  { name: "Neeman's", domains: ['neemans.com'], homeUrl: 'https://neemans.com/', region: 'india' },
  { name: 'Campus', domains: ['campusshoes.com'], homeUrl: 'https://www.campusshoes.com/', region: 'india' },
  { name: 'Bacca Bucci', domains: ['baccabucci.com'], homeUrl: 'https://baccabucci.com/', region: 'india' },
  { name: 'CHNKS', domains: ['chnks.in'], homeUrl: 'https://chnks.in/', region: 'india' },
  { name: 'Almost Gods', domains: ['almostgods.com'], homeUrl: 'https://almostgods.com/', region: 'india' },
  { name: 'Red Tape', domains: ['redtape.com'], homeUrl: 'https://www.redtape.com/', region: 'india' },
];

const ALERT_FROM = /^googlealerts-noreply@google\.com$/i;

export function senderDomain(address: string): string {
  return (address.split('@')[1] ?? '').toLowerCase().trim();
}

export function matchSender(address: string): Sender | null {
  const d = senderDomain(address);
  if (!d) return null;
  return SENDERS.find((s) => s.domains.some((x) => d === x || d.endsWith(`.${x}`))) ?? null;
}

/** Same domain, or one is a subdomain of the other (relaxed alignment, as DMARC does). */
export function aligned(a: string, b: string): boolean {
  const x = a.toLowerCase().replace(/\.$/, '');
  const y = b.toLowerCase().replace(/\.$/, '');
  if (!x || !y) return false;
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
}

/** The domain inside a header value such as "alice@news.nike.com" or "nike.com". */
const domainOf = (v: string) => (v.includes('@') ? v.split('@').pop()! : v).replace(/^<|>$/g, '').toLowerCase();

/**
 * The mailbox provider records what it verified in the Authentication-Results header it adds on receipt. A pass only counts when it vouches for
 * the domain in the From line, otherwise anyone could pass SPF or DKIM for their own domain and put a brand's address in From. Accepted:
 *   - dmarc=pass whose header.from is the From domain, or
 *   - dkim=pass whose signing domain (header.d) is aligned with the From domain, or
 *   - spf=pass whose envelope sender (smtp.mailfrom) is aligned with the From domain.
 * Pass the first (top-most) Authentication-Results header only: the provider's own, added last, is on top; lower ones came with the mail.
 */
export function authenticated(authResults: string, fromAddress: string): boolean {
  const from = senderDomain(fromAddress);
  if (!from) return false;
  for (const part of authResults.split(';')) {
    const m = /^\s*(dkim|spf|dmarc)\s*=\s*pass\b/i.exec(part);
    if (!m) continue;
    const prop = (name: string) => new RegExp(`\\b${name}\\s*=\\s*"?([^\\s";]+)`, 'i').exec(part)?.[1];
    const method = m[1]!.toLowerCase();
    const claimed = method === 'dkim' ? (prop('header\\.d') ?? prop('header\\.i')) : method === 'spf' ? prop('smtp\\.mailfrom') : prop('header\\.from');
    if (!claimed) continue;
    const d = domainOf(claimed);
    if (method === 'dmarc' ? d === from : aligned(d, from)) return true;
  }
  return false;
}

export const isGoogleAlert = (address: string) => ALERT_FROM.test(address.trim());

export interface Row {
  title: string;
  body: string;
  publishedAt: Date;
  source: string;
  url: string;
}

const entities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
const plain = (s: string) => entities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
export const excerpt = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > 180 ? `${t.slice(0, 177).trimEnd()}...` : t;
};

/** Google Alerts wraps every result in google.com/url?...&url=<article>; return the article address, or null when it is not a result link. */
export function unwrapGoogleUrl(href: string): string | null {
  let u: URL;
  try {
    u = new URL(entities(href));
  } catch {
    return null;
  }
  if (!/(^|\.)google\.[a-z.]+$/i.test(u.hostname) || u.pathname !== '/url') return null;
  const target = u.searchParams.get('url') ?? u.searchParams.get('q');
  if (!target || !/^https:\/\//i.test(target)) return null;
  return target;
}

/** One row per result in a Google Alert email's HTML. */
export function alertRows(html: string, when: Date): Row[] {
  const out: Row[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = unwrapGoogleUrl(m[1]!);
    const title = plain(m[2]!);
    if (!url || title.length < 12 || seen.has(url)) continue;
    seen.add(url);
    let host = '';
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      continue;
    }
    out.push({ title: title.slice(0, 200), body: title, publishedAt: when, source: host, url });
  }
  return out;
}

const PROMO_ONLY = /(\d+\s*%\s*off|\bsale\b|discount|coupon|voucher|flat\s+\d+|\bdeals?\b|clearance|free shipping|cashback)/i;
const STRONG = /(drop|launch|release|collab|restock|just landed|raffle|first look|pre-?order)/i;
const NEWSY = /(exclusive|new arrival|arrives|introduc|unveil|announce|available now|out now)/i;

/** A newsletter is worth publishing when it announces something. A clear drop or launch word always counts; otherwise sale and discount mail is out. */
export function isNewsy(subject: string): boolean {
  if (STRONG.test(subject)) return true;
  if (PROMO_ONLY.test(subject)) return false;
  return NEWSY.test(subject);
}

/** One row for a newsletter email. The link is the brand's public page, never the email's own web-version link (it can identify the subscriber). */
export function newsletterRow(sender: Sender, messageId: string, subject: string, text: string, when: Date): Row | null {
  const title = plain(subject).slice(0, 200);
  if (title.length < 8 || !isNewsy(title)) return null;
  const hash = createHash('sha1').update(messageId || `${title}${when.toISOString()}`).digest('hex').slice(0, 12);
  const preface = excerpt(plain(text).replace(/\b(unsubscribe|view (this email )?in (your )?browser|manage preferences)\b.*$/i, ''));
  return { title, body: preface || title, publishedAt: when, source: `${sender.name} newsletter`, url: `${sender.homeUrl}#mail-${hash}` };
}

async function main() {
  const discover = process.argv.includes('--discover');
  const user = process.env.NEWS_IMAP_USER;
  const pass = process.env.NEWS_IMAP_PASSWORD;
  if (!user || !pass) {
    console.log('[email-news] skipped: set NEWS_IMAP_USER and NEWS_IMAP_PASSWORD (an app password) to turn this on');
    return;
  }
  if (!discover && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const { ImapFlow } = await import('imapflow');
  const { simpleParser } = await import('mailparser');
  const client = new ImapFlow({
    host: process.env.NEWS_IMAP_HOST ?? 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  const rows: Row[] = [];
  const unknown = new Map<string, { n: number; subject: string }>();
  let read = 0;
  let forged = 0;
  await client.connect();
  try {
    const lock = await client.getMailboxLock(process.env.NEWS_IMAP_FOLDER ?? 'INBOX', { readOnly: true });
    try {
      const since = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000);
      const uids = ((await client.search({ since }, { uid: true })) || []).slice(-MAX_MESSAGES);
      for await (const msg of client.fetch(uids, { source: true, uid: true }, { uid: true })) {
        read++;
        const mail = await simpleParser(msg.source as Buffer);
        const from = mail.from?.value?.[0]?.address ?? '';
        const when = mail.date ?? new Date();
        const raw = mail.headers.get('authentication-results');
        const auth = Array.isArray(raw) ? raw[0] : raw;
        if (!authenticated(typeof auth === 'string' ? auth : '', from)) {
          forged++;
          continue;
        }
        if (isGoogleAlert(from)) {
          rows.push(...alertRows(typeof mail.html === 'string' ? mail.html : '', when));
          continue;
        }
        const sender = matchSender(from);
        if (!sender) {
          const d = senderDomain(from) || '(none)';
          const cur = unknown.get(d);
          unknown.set(d, { n: (cur?.n ?? 0) + 1, subject: cur?.subject ?? (mail.subject ?? '') });
          continue;
        }
        const row = newsletterRow(sender, mail.messageId ?? '', mail.subject ?? '', mail.text ?? '', when);
        if (row) rows.push(row);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  if (discover) {
    console.log(`[email-news] discover: read ${read} messages from the last ${MAX_AGE_DAYS} days. Senders not on the allow-list (domain, count, a subject):`);
    for (const [d, v] of [...unknown].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${d}\t${v.n}\t${v.subject.slice(0, 80)}`);
    console.log(`[email-news] ${forged} messages ignored because the receiving server did not verify the sender.`);
    console.log(`[email-news] would publish ${rows.length} items from allow-listed senders and alerts.`);
    return;
  }

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    let added = 0;
    for (const r of rows) {
      const res = await pool.query(
        `INSERT INTO news_items (title, body, published_at, source, source_url, is_breaking, is_demo, external)
         VALUES ($1, $2, $3, $4, $5, false, false, true) ON CONFLICT (source_url) WHERE external DO NOTHING`,
        [r.title, r.body, r.publishedAt, r.source, r.url],
      );
      added += res.rowCount ?? 0;
    }
    console.log(`[email-news] read ${read} messages, ${rows.length} publishable, ${added} new, ${forged} ignored (sender not verified)`);
  } finally {
    await pool.end();
  }
}

// Run only when started directly, so the helpers above can be imported by tests.
if (process.argv[1] && /fetch-email-news\.(js|ts)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
