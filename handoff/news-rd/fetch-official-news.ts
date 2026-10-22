/**
 * Official company news, run with the other news scripts:  node --env-file=.env dist/scripts/fetch-official-news.js
 *
 * Two permitted, official sources that need no scraping:
 *   1. SEC EDGAR filings (data.sec.gov JSON API) for listed footwear companies. A Form 8-K is a company's own statement of material news
 *      (results, deals, leadership changes). We store a factual one-line headline written by us from the filing's item codes, and link to
 *      the filing itself.
 *   2. The YouTube Data API v3 (official, keyed) for brand and store channels. We store the video title, date and link, and a 180 character
 *      excerpt of the description, exactly like a feed. YouTube's own RSS path is disallowed by its robots.txt, so the API is the only
 *      permitted route; it needs YOUTUBE_API_KEY and is skipped (with a note) when the key is missing.
 *
 * Same storage rules as fetch-news-feeds.ts: external = true, de-duplicated by link, nothing older than 30 days.
 * EDGAR asks for an identifying User-Agent with contact details and under 10 requests a second; we make a handful with a pause.
 */

const UA = 'CHOSN-price-compare/1.0 (+contact: join.sneakercommunity@gmail.com)';
const PAUSE_MS = 400;
const MAX_AGE_DAYS = 30;

export interface Company {
  name: string;
  cik: string; // 10 digits, zero padded
}
export const COMPANIES: Company[] = [
  { name: 'Nike', cik: '0000320187' },
  { name: 'Crocs', cik: '0001334036' },
  { name: 'Deckers (HOKA, UGG)', cik: '0000910521' },
  { name: 'Under Armour', cik: '0001336917' },
];

export interface Channel {
  name: string;
  channelId: string; // starts with UC; the uploads playlist is the same id with UU
}
// Channel ids read from each channel's public page on 2026-10-21. Still to find and add: PUMA India, ASICS, Comet, Gully Labs, Thaely.
export const CHANNELS: Channel[] = [
  { name: 'Nike', channelId: 'UCNhxq7He5p-_FdBh0OaxcQg' },
  { name: 'adidas', channelId: 'UCuLUOxd7ezJ8c6NSLBNRRfg' },
  { name: 'New Balance', channelId: 'UC1CzgJDVIX-vk2hQzeubT7A' },
  { name: 'Reebok', channelId: 'UChJHUmT_EREEs4WV6jpmnBw' },
  { name: 'Converse', channelId: 'UCfigptVgX1LGgUKZkQ2BZMQ' },
  { name: 'Vans', channelId: 'UCnJ0mt5Cgx4ER_LhTijG_4A' },
  { name: 'Crepdog Crew', channelId: 'UCn_sHZ0DmPRNmR0K9xe2ohA' },
  { name: 'Superkicks', channelId: 'UCIAFV8nKv-gp4rQnxiFEfRw' },
];

/** What each 8-K item code means, in plain words (SEC Form 8-K general instructions). Codes not listed are ignored. */
const ITEMS: Record<string, string> = {
  '1.01': 'a major agreement',
  '1.02': 'the end of a major agreement',
  '2.01': 'a completed acquisition or sale',
  '2.02': 'its financial results',
  '2.05': 'restructuring costs',
  '5.02': 'a change in leadership',
  '7.01': 'a company announcement',
  '8.01': 'other company news',
};

export interface Filing {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
  items: string;
}

/** Our own headline for an 8-K, or null when it carries nothing newsworthy (for example a vote result alone, item 5.07). */
export function filingHeadline(company: string, f: Filing): string | null {
  const said = f.items
    .split(',')
    .map((c) => ITEMS[c.trim()])
    .filter((x): x is string => Boolean(x));
  if (said.length === 0) return null;
  const unique = [...new Set(said)];
  const list = unique.length === 1 ? unique[0]! : `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`;
  return `${company} reports ${list} in an official SEC filing`;
}

export function filingUrl(cik: string, f: Filing): string {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${f.accessionNumber.replace(/-/g, '')}/${f.primaryDocument}`;
}

export function recentEightKs(recent: { form: string[]; filingDate: string[]; accessionNumber: string[]; primaryDocument: string[]; items: string[] }): Filing[] {
  const out: Filing[] = [];
  for (let i = 0; i < recent.form.length; i++) {
    if (recent.form[i] !== '8-K') continue;
    out.push({
      form: '8-K',
      filingDate: recent.filingDate[i]!,
      accessionNumber: recent.accessionNumber[i]!,
      primaryDocument: recent.primaryDocument[i]!,
      items: recent.items[i] ?? '',
    });
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const excerpt = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > 180 ? `${t.slice(0, 177).trimEnd()}...` : t;
};

interface Row {
  title: string;
  body: string;
  publishedAt: Date;
  source: string;
  url: string;
}

async function secRows(): Promise<{ rows: Row[]; report: string[] }> {
  const rows: Row[] = [];
  const report: string[] = [];
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  for (const c of COMPANIES) {
    await sleep(PAUSE_MS);
    try {
      const res = await fetch(`https://data.sec.gov/submissions/CIK${c.cik}.json`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) { report.push(`SEC ${c.name}: HTTP ${res.status}`); continue; }
      const json = (await res.json()) as { filings: { recent: Parameters<typeof recentEightKs>[0] } };
      let n = 0;
      for (const f of recentEightKs(json.filings.recent)) {
        const when = new Date(`${f.filingDate}T12:00:00Z`);
        const title = filingHeadline(c.name, f);
        if (!title || when.getTime() < cutoff) continue;
        rows.push({ title, body: title, publishedAt: when, source: `${c.name} (SEC filing)`, url: filingUrl(c.cik, f) });
        n++;
      }
      report.push(`SEC ${c.name}: ${n} recent 8-K`);
    } catch (e) {
      report.push(`SEC ${c.name}: ${(e as Error).message}`);
    }
  }
  return { rows, report };
}

// Brand channels also post sport and corporate videos; keep what is about shoes, drops and collabs.
const FOOTWEAR = /sneaker|shoe|footwear|kicks|trainer|drop|release|collab|launch|pack|colorway|retro|dunk|air max|air force|jordan|samba|gazelle|campus|550|990|clog|spezial|yeezy|ultraboost|pegasus|vomero|kayano|gel-/i;

export function videoRow(ch: Channel, item: { snippet: { title: string; description: string; publishedAt: string; resourceId: { videoId: string } } }): Row | null {
  const s = item.snippet;
  if (!FOOTWEAR.test(`${s.title} ${s.description.slice(0, 200)}`)) return null;
  return { title: s.title.slice(0, 200), body: excerpt(s.description) || s.title, publishedAt: new Date(s.publishedAt), source: `${ch.name} on YouTube`, url: `https://www.youtube.com/watch?v=${s.resourceId.videoId}` };
}

async function youtubeRows(): Promise<{ rows: Row[]; report: string[] }> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { rows: [], report: ['YouTube: skipped (YOUTUBE_API_KEY is not set)'] };
  const rows: Row[] = [];
  const report: string[] = [];
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  for (const ch of CHANNELS) {
    await sleep(PAUSE_MS);
    try {
      const uploads = `UU${ch.channelId.slice(2)}`;
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=15&playlistId=${uploads}&key=${key}`;
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) { report.push(`YouTube ${ch.name}: HTTP ${res.status}`); continue; }
      const json = (await res.json()) as { items?: Parameters<typeof videoRow>[1][] };
      const kept = (json.items ?? []).map((it) => videoRow(ch, it)).filter((r): r is Row => r !== null && r.publishedAt.getTime() >= cutoff);
      rows.push(...kept);
      report.push(`YouTube ${ch.name}: ${(json.items ?? []).length} uploads, ${kept.length} kept`);
    } catch (e) {
      report.push(`YouTube ${ch.name}: ${(e as Error).message}`);
    }
  }
  return { rows, report };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const [sec, yt] = await Promise.all([secRows(), youtubeRows()]);
    let added = 0;
    for (const r of [...sec.rows, ...yt.rows]) {
      const res = await pool.query(
        `INSERT INTO news_items (title, body, published_at, source, source_url, is_breaking, is_demo, external)
         VALUES ($1, $2, $3, $4, $5, false, false, true) ON CONFLICT (source_url) WHERE external DO NOTHING`,
        [r.title, r.body, r.publishedAt, r.source, r.url],
      );
      added += res.rowCount ?? 0;
    }
    console.log(`[official-news] ${added} new items`);
    for (const line of [...sec.report, ...yt.report]) console.log('  -', line);
  } finally {
    await pool.end();
  }
}

// Run only when started directly, so the helpers above can be imported by tests.
if (process.argv[1] && /fetch-official-news\.(js|ts)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
