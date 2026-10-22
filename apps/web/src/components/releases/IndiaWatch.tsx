/**
 * Indian homegrown brands and India-only collabs: what they last released and whether a next drop has been announced. These brands
 * mostly announce drops on their own website and Instagram a few days ahead, so there is rarely a public date far in advance. Everything
 * here is read from the cited page; "last checked" says when.
 */
export const INDIA_WATCH_CHECKED = '20 Oct 2026';

interface Entry {
  name: string;
  note: string;
  latest: string;
  next: string;
  sources: Array<{ label: string; url: string }>;
}

const ENTRIES: Entry[] = [
  {
    name: 'Comet',
    note: 'Bengaluru · limited drops, usually no restocks',
    latest: 'UNO x COMET low-top, 9 Jul 2026, 6 PM IST. 800 pairs, sold through its own website.',
    next: 'No next drop announced.',
    sources: [
      { label: 'House of Heat', url: 'https://houseofheat.co/uno-x-the-comet-universe-sneakers-release-details' },
      { label: 'Indian Retailer', url: 'https://indianretailer.com/article/d2c-new-commerce/perspectives/d2c-100-comet-indias-rising-sneaker-disruptor' },
    ],
  },
  {
    name: 'Gully Labs',
    note: 'Delhi · Gully Number 001 and collabs',
    latest: 'Thums Up collab (September 2026), GL001 in Toofani White and Toofani Blue, listed at ₹5,000. Earlier: CMF by Nothing x Gully Labs final drop, 30 May 2026, 7 PM IST.',
    next: 'No next drop announced. Its site lists a Sienna collab (200 pairs) and GL001 x Raga and x Aryan Katoch at ₹5,990.',
    sources: [
      { label: 'Esquire India', url: 'https://www.esquireindia.co.in/style/grooming/4-cool-september-sneaker-drops-were-loving' },
      { label: 'Media Infoline', url: 'https://www.mediainfoline.com/brand/cmf-and-gully-labs-announce-final-exclusive-drop-of-their-co-created-sneaker' },
      { label: 'gullylabs.com', url: 'https://gullylabs.com' },
    ],
  },
  {
    name: 'Almost Gods',
    note: 'Debut sneaker',
    latest: 'Tether, listed at ₹15,000 (May 2026).',
    next: 'No next drop announced.',
    sources: [{ label: 'Harper’s Bazaar India', url: 'https://www.harpersbazaar.in/fashion/story/from-travis-scott-to-puma-x-superkicks-the-coolest-sneaker-drops-to-know-now-1394208-2026-05-22' }],
  },
  {
    name: 'Puma x Superkicks',
    note: 'India-only collab',
    latest: 'Palermo “Jamun”, listed at ₹7,999 (May 2026).',
    next: 'No next drop announced.',
    sources: [{ label: 'Harper’s Bazaar India', url: 'https://www.harpersbazaar.in/fashion/story/from-travis-scott-to-puma-x-superkicks-the-coolest-sneaker-drops-to-know-now-1394208-2026-05-22' }],
  },
  {
    name: 'Limited Edt x adidas',
    note: 'India-made collab',
    latest: 'Superstar Consortium “Made in India”, sold in India and Singapore.',
    next: 'No next drop announced.',
    sources: [{ label: 'T2 Online', url: 'https://t2online.in/goodlife/fashion-beauty/limited-edt-x-adidas--check-out-this-gorgeous-sneaker-collection-inspired-by-indian-visual-heritage/2007057' }],
  },
];

const ALSO = ['Thaely', 'Neeman’s', 'CHNKS', 'Bacca Bucci', 'Campus', 'Go CKH'];

interface Scanned {
  checked: string | null;
  brands: Array<{ brand: string; products: Array<{ title: string; url: string; priceInr: number | null; available: boolean; kind: string }> }>;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function loadScanned(): Promise<Scanned | null> {
  try {
    const res = await fetch(`${API}/drops/india-watch`, { next: { revalidate: 3600 } });
    return res.ok ? ((await res.json()) as Scanned) : null;
  } catch {
    return null;
  }
}

const KIND_LABEL: Record<string, string> = { preorder: 'Pre-order', coming_soon: 'Coming soon' };

/** The newest public products each brand lists on its own site, scanned nightly. A pre-order or coming-soon item is the closest thing to an announced drop. */
function Scan({ products }: { products: Scanned['brands'][number]['products'] }) {
  return (
    <ul className="flex flex-col gap-1 border-t border-text/10 pt-2 text-sm text-text">
      {products.map((p) => (
        <li key={p.url} className="flex items-baseline justify-between gap-3">
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate underline-offset-2 hover:underline">
            {KIND_LABEL[p.kind] ? <span className="mr-1.5 font-bold">{KIND_LABEL[p.kind]}:</span> : null}
            {p.title}
          </a>
          <span className="shrink-0 font-mono text-xs text-text-soft">{p.priceInr ? `₹${p.priceInr.toLocaleString('en-IN')}` : ''}</span>
        </li>
      ))}
    </ul>
  );
}

export async function IndiaWatch() {
  const scanned = await loadScanned();
  const byName = new Map((scanned?.brands ?? []).map((b) => [b.brand.toLowerCase(), b.products]));
  const covered = new Set(ENTRIES.map((e) => e.name.toLowerCase()));
  const extra = (scanned?.brands ?? []).filter((b) => !covered.has(b.brand.toLowerCase()));
  const checked = scanned?.checked ? new Date(scanned.checked).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : INDIA_WATCH_CHECKED;
  return (
    <section aria-labelledby="india-h">
      <h2 id="india-h" className="font-display text-2xl font-bold text-text">Homegrown watch</h2>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-text-soft">
        Indian brands announce most drops on their own website and Instagram a few days ahead, so a date is rarely public early. Here is what each last released and whether a next drop is out. Last checked {checked}.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ENTRIES.map((e) => (
          <li key={e.name} className="flex flex-col gap-2 rounded-2xl border border-text/12 bg-white p-5">
            <div>
              <h3 className="font-display text-xl font-bold uppercase leading-tight text-text">{e.name}</h3>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-faint">{e.note}</p>
            </div>
            <p className="text-sm text-text"><span className="font-bold">Latest:</span> {e.latest}</p>
            <p className="text-sm text-text-soft"><span className="font-bold text-text">Next:</span> {e.next}</p>
            {byName.get(e.name.toLowerCase()) ? <Scan products={byName.get(e.name.toLowerCase())!} /> : null}
            <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-faint">
              Sources:
              {e.sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-text underline underline-offset-2">
                  {s.label}
                </a>
              ))}
            </p>
          </li>
        ))}
        {extra.map((b) => (
          <li key={b.brand} className="flex flex-col gap-2 rounded-2xl border border-text/12 bg-white p-5">
            <h3 className="font-display text-xl font-bold uppercase leading-tight text-text">{b.brand}</h3>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-faint">Newest on their own site</p>
            <Scan products={b.products} />
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-text-soft">
        Also on our radar, with no dated drop found yet: {ALSO.join(', ')}. When a date is announced, it goes on the calendar above.
      </p>
    </section>
  );
}
