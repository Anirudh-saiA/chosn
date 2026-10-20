/**
 * Gather sneaker and fashion news from other sites' public feeds:  node --env-file=.env dist/scripts/fetch-news-feeds.js
 *
 * Polite and identified: each site's robots.txt is read first and a feed that disallows us (or cannot be checked) is skipped, one request
 * per feed with a pause between them, and the User-Agent says who we are. What is stored is only what a feed is published for: the
 * headline, a short excerpt (180 characters), the date and the link. The site shows the headline with "Read at <site>", so readers go to
 * the original. Items are de-duplicated by link, older than 30 days are ignored, and gathered items older than 45 days are removed.
 */
import { Pool } from 'pg';

const UA = 'CHOSN-price-compare/1.0 (+contact: join.sneakercommunity@gmail.com)';
const PAUSE_MS = 1500;
const MAX_PER_FEED = 20;
const SNEAKER = /sneaker|shoe|footwear|kicks|trainer|nike|jordan|adidas|puma|asics|new balance|reebok|yeezy|converse|vans|onitsuka|hoka|salomon|crocs|birkenstock|drop|release|collab/i;
// General fashion and news feeds: only items that are clearly about sneakers or footwear (no loose words like "drop" or "release").
const STRICT = /sneaker|footwear|kicks|trainers?|nike|air jordan|adidas|puma|asics|new balance|reebok|yeezy|converse|onitsuka|hoka|salomon|birkenstock|shoes?/i;

interface Feed {
  name: string;
  url: string;
  /** Only keep items that look sneaker-related: true = loose match, 'strict' = clearly about sneakers or footwear (general news and fashion feeds). */
  filter?: boolean | 'strict';
  region: 'global' | 'india';
}

export const FEEDS: Feed[] = [
  { name: 'Hypebeast', url: 'https://hypebeast.com/footwear/feed', region: 'global' },
  { name: 'Highsnobiety', url: 'https://www.highsnobiety.com/feed/', filter: true, region: 'global' },
  { name: 'Sneaker Bar Detroit', url: 'https://sneakerbardetroit.com/feed/', region: 'global' },
  { name: 'Just Fresh Kicks', url: 'https://justfreshkicks.com/feed/', region: 'global' },
  { name: 'WearTesters', url: 'https://weartesters.com/feed/', region: 'global' },
  { name: 'Sneaker Files', url: 'https://www.sneakerfiles.com/feed/', region: 'global' },
  { name: 'Esquire India', url: 'https://www.esquireindia.co.in/stories.rss', filter: true, region: 'india' },
  { name: 'GQ India', url: 'https://www.gqindia.com/feed/rss', filter: true, region: 'india' },
  // Added after a wider check of 85 candidate sources (scripts/probe_sources.py): each one's robots.txt allows us and it publishes a public feed.
  { name: 'SoleSavy', url: 'https://solesavy.com/feed/', region: 'global' },
  { name: 'Footwear News', url: 'https://footwearnews.com/feed/', filter: 'strict', region: 'global' },
  { name: 'Gear Patrol', url: 'https://gearpatrol.com/feed/', filter: 'strict', region: 'global' },
  { name: 'Fashionista', url: 'https://fashionista.com/.rss/full/', filter: 'strict', region: 'global' },
  { name: 'Business of Fashion', url: 'https://www.businessoffashion.com/arc/outboundfeeds/rss/', filter: 'strict', region: 'global' },
  { name: 'Vogue', url: 'https://www.vogue.com/feed/rss', filter: 'strict', region: 'global' },
  { name: 'GQ', url: 'https://www.gq.com/feed/rss', filter: 'strict', region: 'global' },
  { name: 'Esquire', url: 'https://www.esquire.com/rss/all.xml/', filter: 'strict', region: 'global' },
  { name: 'Dazed', url: 'https://www.dazeddigital.com/rss', filter: 'strict', region: 'global' },
  { name: 'Vogue India', url: 'https://www.vogue.in/feed/rss', filter: 'strict', region: 'india' },
  { name: 'Rolling Stone India', url: 'https://rollingstoneindia.com/feed/', filter: 'strict', region: 'india' },
  { name: 'Hindustan Times Lifestyle', url: 'https://www.hindustantimes.com/feeds/rss/lifestyle/rssfeed.xml', filter: 'strict', region: 'india' },
  { name: 'Times of India Fashion', url: 'https://timesofindia.indiatimes.com/rssfeeds/2886704.cms', filter: 'strict', region: 'india' },
  { name: 'Indian Express Lifestyle', url: 'https://indianexpress.com/section/lifestyle/feed/', filter: 'strict', region: 'india' },
  { name: 'Economic Times Retail', url: 'https://retail.economictimes.indiatimes.com/rss/topstories', filter: 'strict', region: 'india' },
  { name: 'Inc42', url: 'https://inc42.com/feed/', filter: 'strict', region: 'india' },
  { name: 'YourStory', url: 'https://yourstory.com/feed', filter: 'strict', region: 'india' },
  { name: 'India Fashion Icon', url: 'https://indiafashionicon.com/feed/', filter: 'strict', region: 'india' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Minimal robots.txt check: may the "*" (or our own) group fetch this path? Unreadable robots.txt means do not fetch. */
async function allowed(url: string): Promise<boolean> {
  const u = new URL(url);
  try {
    const res = await fetch(`${u.origin}/robots.txt`, { headers: { 'User-Agent': UA } });
    if (res.status === 404) return true;
    if (!res.ok) return false;
    const lines = (await res.text()).split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim());
    let applies = false;
    let blocked = false;
    let allow = -1;
    for (const l of lines) {
      const m = l.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (!m) {
        if (l === '') continue;
        continue;
      }
      const key = m[1]!.toLowerCase();
      const val = m[2]!.trim();
      if (key === 'user-agent') applies = val === '*' || /chosn/i.test(val);
      else if (applies && key === 'disallow' && val && u.pathname.startsWith(val)) blocked = blocked || val.length > allow;
      else if (applies && key === 'allow' && val && u.pathname.startsWith(val)) allow = Math.max(allow, val.length);
    }
    return !blocked || allow >= 0;
  } catch {
    return false;
  }
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“')
    .replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&#038;/g, '&')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ');
const text = (s: string) => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (block: string, name: string) => block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1];

interface Item {
  title: string;
  link: string;
  date: Date;
  excerpt: string;
}

function parse(xml: string): Item[] {
  const out: Item[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks) {
    const title = text(tag(b, 'title') ?? '');
    // The link is plain text, wrapped in CDATA (Times of India, Hindustan Times), or an Atom href attribute.
    const plain = text(tag(b, 'link') ?? '');
    const link = /^https?:\/\//.test(plain) ? plain : (b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '');
    const when = tag(b, 'pubDate') ?? tag(b, 'dc:date') ?? tag(b, 'published') ?? tag(b, 'updated') ?? '';
    const date = new Date(text(when));
    const desc = text(tag(b, 'description') ?? tag(b, 'summary') ?? tag(b, 'content:encoded') ?? '');
    if (!title || !/^https?:\/\//.test(link) || Number.isNaN(date.getTime())) continue;
    out.push({ title: title.slice(0, 200), link: link.trim(), date, excerpt: desc.length > 180 ? `${desc.slice(0, 177).trimEnd()}...` : desc });
  }
  return out;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const cutoff = Date.now() - 30 * 86_400_000;
  let added = 0;
  const report: string[] = [];
  try {
    for (const [i, f] of FEEDS.entries()) {
      if (i > 0) await sleep(PAUSE_MS);
      if (!(await allowed(f.url))) { report.push(`${f.name}: skipped (robots.txt)`); continue; }
      let items: Item[];
      try {
        const res = await fetch(f.url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
        if (!res.ok) { report.push(`${f.name}: HTTP ${res.status}`); continue; }
        items = parse(await res.text());
      } catch (e) {
        report.push(`${f.name}: ${(e as Error).message}`);
        continue;
      }
      const fresh = items
        .filter((it) => it.date.getTime() >= cutoff && (!f.filter || (f.filter === 'strict' ? STRICT : SNEAKER).test(`${it.title} ${it.excerpt}`)))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, MAX_PER_FEED);
      let n = 0;
      for (const it of fresh) {
        const res = await pool.query(
          `INSERT INTO news_items (title, body, published_at, source, source_url, is_breaking, is_demo, external)
           VALUES ($1, $2, $3, $4, $5, false, false, true) ON CONFLICT (source_url) WHERE external DO NOTHING`,
          [it.title, it.excerpt || it.title, it.date, f.name, it.link],
        );
        n += res.rowCount ?? 0;
      }
      added += n;
      report.push(`${f.name}: ${items.length} in feed, ${fresh.length} recent, ${n} new`);
    }
    const gone = await pool.query(`DELETE FROM news_items WHERE external AND published_at < now() - interval '45 days'`);
    console.log(`[news-feeds] ${added} new items; ${gone.rowCount ?? 0} old removed`);
    for (const r of report) console.log('  -', r);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
