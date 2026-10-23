/**
 * Gather sneaker and fashion news from other sites' public feeds:  node --env-file=.env dist/scripts/fetch-news-feeds.js [--dry]
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
// Celebrity, awards and fashion-event feeds. A footwear word may sit anywhere (headline or excerpt). A fashion EVENT word must be in the headline
// itself, because an excerpt that mentions "runway" or "viral" is usually about something else. Shopping lists and "how to style" pieces are dropped.
const FOOTWEAR = /sneaker|footwear|\bkicks\b|\btrainers?\b|air jordan|jordan brand|\b(nike|adidas|puma|asics|new balance|reebok|converse|vans|hoka|salomon)\b/i;
const EVENT_TITLE = /red carpet|\bgala\b|met gala|\bawards?\b|fashion (week|show)|runway|best[- ]dressed|worst[- ]dressed|street ?style|couture|victoria.s secret|\b(iifa|filmfare|oscars?|grammys?|emmys?|bafta|cannes|golden globes?)\b|\b(ss|fw|aw)\d{2}\b|viral (outfit|look|dress|gown|moment)/i;
const SHOPPING = /\b(shop|on[- ]sale|under \$\d+|ways to (style|wear)|basics|must-haves?)\b/i;
const keepCulture = (title: string, excerpt: string) => FOOTWEAR.test(`${title} ${excerpt}`) || (EVENT_TITLE.test(title) && !SHOPPING.test(title));
// General fashion and news feeds: only items whose HEADLINE is clearly about sneakers or footwear (no loose words like "drop" or "release"; an excerpt that mentions shoes in passing does not count).
// Brand names are whole words ("asics" inside "basics" is not sneaker news) and "trainer" alone is usually a fitness trainer.
const STRICT = /sneaker|footwear|\bkicks\b|\btrainers\b|\b(nike|air jordan|adidas|puma|asics|new balance|reebok|yeezy|converse|onitsuka|hoka|salomon|birkenstock)\b|\bshoes?\b/i;
// General news and lifestyle feeds (Indian outlets): same, but the bare word "shoe" alone is too loose (health and wellness pieces mention shoes).
const STRICT_NO_BARE_SHOE = /sneaker|footwear|\bkicks\b|\btrainers\b|\b(nike|air jordan|adidas|puma|asics|new balance|reebok|yeezy|converse|onitsuka|hoka|salomon|birkenstock)\b/i;
// Shopping deals, how-to and evergreen list pieces are not news or drops: dropped by headline from the general feeds and the brand blogs.
const NOT_NEWS = /\b(half off|below retail|\d+% off|on sale|deals?|discount|coupon)\b|\bhow to\b|\bways to\b|\btips\b|\bguide\b|\bshould own\b|\bevery (man|woman) should\b/i;

interface Feed {
  name: string;
  url: string;
  /** Only keep items that look sneaker-related: true = loose match, 'strict' = clearly about sneakers or footwear (general news and fashion feeds),
   *  'culture' = footwear OR a fashion event / viral outfit (celebrity, awards and fashion-week feeds). */
  filter?: boolean | 'strict' | 'culture' | 'brand' | 'general';
  region: 'global' | 'india';
}

/** Does a feed item belong on CHOSN? Sneaker feeds keep everything; general feeds keep headlines clearly about footwear; brand blogs keep announcements. */
export function keep(f: Pick<Feed, 'filter'>, title: string, excerpt: string): boolean {
  if (!f.filter) return true;
  if (f.filter === 'culture') return keepCulture(title, excerpt);
  if (f.filter === 'strict') return STRICT.test(title) && !NOT_NEWS.test(title);
  if (f.filter === 'general') return STRICT_NO_BARE_SHOE.test(title) && !NOT_NEWS.test(title);
  if (f.filter === 'brand') return !NOT_NEWS.test(title);
  return SNEAKER.test(`${title} ${excerpt}`);
}

export const FEEDS: Feed[] = [
  { name: 'Hypebeast', url: 'https://hypebeast.com/footwear/feed', region: 'global' },
  { name: 'Highsnobiety', url: 'https://www.highsnobiety.com/feed/', filter: 'strict', region: 'global' },
  { name: 'Sneaker Bar Detroit', url: 'https://sneakerbardetroit.com/feed/', region: 'global' },
  { name: 'Just Fresh Kicks', url: 'https://justfreshkicks.com/feed/', region: 'global' },
  { name: 'WearTesters', url: 'https://weartesters.com/feed/', region: 'global' },
  { name: 'Sneaker Files', url: 'https://www.sneakerfiles.com/feed/', region: 'global' },
  { name: 'Esquire India', url: 'https://www.esquireindia.co.in/stories.rss', filter: 'strict', region: 'india' },
  { name: 'GQ India', url: 'https://www.gqindia.com/feed/rss', filter: 'strict', region: 'india' },
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
  { name: 'Rolling Stone India', url: 'https://rollingstoneindia.com/feed/', filter: 'general', region: 'india' },
  { name: 'Hindustan Times Lifestyle', url: 'https://www.hindustantimes.com/feeds/rss/lifestyle/rssfeed.xml', filter: 'general', region: 'india' },
  { name: 'Times of India Fashion', url: 'https://timesofindia.indiatimes.com/rssfeeds/2886704.cms', filter: 'general', region: 'india' },
  { name: 'Indian Express Lifestyle', url: 'https://indianexpress.com/section/lifestyle/feed/', filter: 'general', region: 'india' },
  { name: 'Economic Times Retail', url: 'https://retail.economictimes.indiatimes.com/rss/topstories', filter: 'general', region: 'india' },
  { name: 'Inc42', url: 'https://inc42.com/feed/', filter: 'general', region: 'india' },
  { name: 'YourStory', url: 'https://yourstory.com/feed', filter: 'general', region: 'india' },
  { name: 'India Fashion Icon', url: 'https://indiafashionicon.com/feed/', filter: 'general', region: 'india' },
  // Indian brand and store blogs (Shopify Atom feeds). The brands' own announcements, checked 2026-10-21; several blogs are quiet, which is harmless.
  { name: 'Campus', url: 'https://www.campusshoes.com/blogs/news.atom', filter: 'brand', region: 'india' },
  { name: 'Gully Labs', url: 'https://gullylabs.com/blogs/news.atom', filter: 'brand', region: 'india' },
  { name: 'Superkicks', url: 'https://www.superkicks.in/blogs/news.atom', filter: 'brand', region: 'india' },
  { name: 'Limited Edt', url: 'https://limitededt.in/blogs/news.atom', filter: 'brand', region: 'india' },
  { name: 'Thaely', url: 'https://thaely.com/blogs/news.atom', filter: 'brand', region: 'india' },
  { name: 'Crepdog Crew', url: 'https://crepdogcrew.com/blogs/news.atom', filter: 'brand', region: 'india' },
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
  // --dry: fetch and filter every feed and print what would be kept, without touching the database (feed health checks).
  const dry = process.argv.includes('--dry');
  if (!dry && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = dry ? null : new Pool({ connectionString: process.env.DATABASE_URL });
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
        .filter((it) => it.date.getTime() >= cutoff && keep(f, it.title, it.excerpt))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, MAX_PER_FEED);
      let n = 0;
      for (const it of fresh) {
        if (!pool) {
          console.log(`    ${f.name} | ${it.title}`);
          continue;
        }
        const res = await pool.query(
          `INSERT INTO news_items (title, body, published_at, source, source_url, is_breaking, is_demo, external)
           VALUES ($1, $2, $3, $4, $5, false, false, true) ON CONFLICT (source_url) WHERE external DO NOTHING`,
          [it.title, it.excerpt || it.title, it.date, f.name, it.link],
        );
        n += res.rowCount ?? 0;
      }
      added += n;
      // Stories stored before a filter was tightened go when they no longer pass it (same feed, same rule).
      if (f.filter && pool) {
        const { rows } = await pool.query<{ id: string; title: string; body: string }>(`SELECT id, title, body FROM news_items WHERE external AND source = $1`, [f.name]);
        const stale = rows.filter((r) => !keep(f, r.title, r.body)).map((r) => r.id);
        if (stale.length) {
          await pool.query(`DELETE FROM news_items WHERE id = ANY($1::uuid[])`, [stale]);
          report.push(`${f.name}: ${stale.length} stored off-topic stories removed`);
        }
      }
      report.push(`${f.name}: ${items.length} in feed, ${fresh.length} recent, ${n} new`);
    }
    const gone = pool ? await pool.query(`DELETE FROM news_items WHERE external AND published_at < now() - interval '45 days'`) : null;
    console.log(`[news-feeds] ${dry ? 'dry run, nothing stored' : `${added} new items; ${gone?.rowCount ?? 0} old removed`}`);
    for (const r of report) console.log('  -', r);
  } finally {
    await pool?.end();
  }
}

// Run only when started directly, so the filter can be imported by tests.
if (process.argv[1] && /fetch-news-feeds\.(js|ts)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
