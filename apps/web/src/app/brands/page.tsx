import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Brands',
  description: 'Every sneaker brand on CHOSN, A to Z, each with the same space. Pick one to see its shoes and compare prices.',
};

export const revalidate = 600;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface BrandCount {
  value: string;
  count: number;
}

async function load(): Promise<BrandCount[] | null> {
  try {
    const res = await fetch(`${API_URL}/catalog/search?limit=1`, { next: { revalidate } });
    if (!res.ok) return null;
    return ((await res.json()) as { facets: { brands: BrandCount[] } }).facets.brands;
  } catch {
    return null;
  }
}

const initial = (name: string) => {
  const c = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
};

export default async function BrandsPage() {
  const brands = await load();
  const sorted = [...(brands ?? [])].sort((a, b) => a.value.localeCompare(b.value, 'en', { sensitivity: 'base' }));
  const groups = new Map<string, BrandCount[]>();
  for (const b of sorted) groups.set(initial(b.value), [...(groups.get(initial(b.value)) ?? []), b]);
  const letters = [...groups.keys()];
  const total = sorted.reduce((n, b) => n + b.count, 0);

  return (
    <PageShell width="4xl">
      <PageHeader eyebrow="Browse by brand" title="Brands" />

      <p className="mb-2 max-w-2xl text-[0.98rem] text-text-soft">
        Every brand gets the same space here, A to Z, whether it has thousands of shoes or one. The number is how many shoes are in stock
        right now.
      </p>
      {brands && (
        <p className="mb-6 font-mono text-[0.78rem] font-bold uppercase tracking-[0.14em] text-text-faint">
          {sorted.length} brands · {total.toLocaleString('en-IN')} shoes
        </p>
      )}

      {!brands ? (
        <p className="py-10 text-center text-text-soft">Brands are unavailable right now.</p>
      ) : (
        <>
          <nav aria-label="Jump to letter" className="sticky top-16 z-10 mb-6 flex flex-wrap gap-1 rounded-2xl border border-text/10 bg-white/90 p-2 backdrop-blur">
            {letters.map((l) => (
              <a key={l} href={`#letter-${l === '#' ? 'num' : l}`} className="flex h-11 min-w-11 items-center justify-center rounded-lg px-2 font-mono text-[0.8rem] font-bold text-text-soft hover:bg-text/5 hover:text-text">
                {l}
              </a>
            ))}
          </nav>

          <div className="space-y-8">
            {[...groups.entries()].map(([letter, list]) => (
              <section key={letter} id={`letter-${letter === '#' ? 'num' : letter}`} className="scroll-mt-28">
                <h2 className="mb-3 font-display text-2xl font-bold text-text">{letter}</h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {list.map((b) => (
                    <li key={b.value}>
                      <Link
                        href={`/sneakers?brand=${encodeURIComponent(b.value)}`}
                        className="flex h-28 flex-col justify-between rounded-2xl border border-text/10 bg-white p-4 transition-colors hover:border-[#9A5A00]/60 hover:bg-[#FFFBF3]"
                      >
                        <span className="line-clamp-2 font-display text-lg font-bold leading-tight text-text">{b.value}</span>
                        <span className="font-mono text-[0.74rem] font-bold uppercase tracking-[0.12em] text-text-soft">
                          {b.count.toLocaleString('en-IN')} {b.count === 1 ? 'shoe' : 'shoes'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
