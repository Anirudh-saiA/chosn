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

export function IndiaWatch() {
  return (
    <section aria-labelledby="india-h">
      <h2 id="india-h" className="font-display text-2xl font-bold text-text">Homegrown watch</h2>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-text-soft">
        Indian brands announce most drops on their own website and Instagram a few days ahead, so a date is rarely public early. Here is what each last released and whether a next drop is out. Last checked {INDIA_WATCH_CHECKED}.
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
      </ul>
      <p className="mt-4 text-sm text-text-soft">
        Also on our radar, with no dated drop found yet: {ALSO.join(', ')}. When a date is announced, it goes on the calendar above.
      </p>
    </section>
  );
}
