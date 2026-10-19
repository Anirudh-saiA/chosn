import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const REVALIDATE = 600;

interface SearchBits {
  total: number;
  facets: { brands: Array<{ value: string; count: number }> };
  results: Array<{ brand: string; model: string }>;
}

async function search(params: Record<string, string>): Promise<SearchBits | null> {
  try {
    const res = await fetch(`${API_URL}/catalog/search?${new URLSearchParams({ limit: '8', ...params })}`, { next: { revalidate: REVALIDATE } });
    return res.ok ? ((await res.json()) as SearchBits) : null;
  } catch {
    return null;
  }
}

// Labels and the search that each one runs. A link is shown only if that search finds shoes right now, so none is a dead end.
const STYLES: Array<{ label: string; params: Record<string, string> }> = [
  { label: 'Running shoes', params: { q: 'running' } },
  { label: 'Basketball shoes', params: { q: 'basketball' } },
  { label: 'Slides & mules', params: { q: 'slide' } },
  { label: 'Boots', params: { q: 'boot' } },
  { label: 'Sandals', params: { q: 'sandal' } },
  { label: 'Retro classics', params: { q: 'retro' } },
  { label: 'Casual shoes', params: { q: 'casual' } },
];
const DEALS: Array<{ label: string; params: Record<string, string> }> = [
  { label: 'Under ₹5,000', params: { maxPrice: '5000' } },
  { label: 'Under ₹10,000', params: { maxPrice: '10000' } },
  { label: 'Under ₹20,000', params: { maxPrice: '20000' } },
  { label: 'Jordans under ₹10,000', params: { brand: 'Jordan', maxPrice: '10000' } },
  { label: 'Compared at 4+ stores', params: { minStores: '4' } },
  { label: 'Compared at 3+ stores', params: { minStores: '3' } },
];
const LUXURY = ['Balenciaga', 'Golden Goose', 'Prada', 'Off-White', 'Y-3', 'Represent', 'Fear Of God', 'Telfar', 'Loewe', 'Hermes', 'Gucci', 'Louis Vuitton', 'Alexander McQueen', 'Maison Margiela', 'Rick Owens', 'Amiri'];

const href = (params: Record<string, string>) => `/sneakers?${new URLSearchParams(params)}`;

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-[1.05rem] uppercase tracking-[0.04em] text-[#0A0A0A]">{title}</h3>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

function Item({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={to} className="text-[0.82rem] font-semibold uppercase tracking-[0.04em] text-[#0A0A0A]/70 transition-colors hover:text-[#0A0A0A]">
        {children}
      </Link>
    </li>
  );
}

/**
 * Quick links at the foot of the Compare page: brands, the most-compared models, luxury labels, styles and price bands. Built from
 * the live catalogue, so every link leads to shoes, and brands are ordered by how many shoes they have, not by who pays.
 */
export async function BrowseShortcuts() {
  const [base, ...checks] = await Promise.all([
    search({}),
    ...STYLES.map((s) => search({ ...s.params, limit: '1' })),
    ...DEALS.map((d) => search({ ...d.params, limit: '1' })),
  ]);
  if (!base) return null;

  const luxuryKeys = new Set(LUXURY.map((n) => n.toLowerCase()));
  const brands = [...base.facets.brands].sort((a, b) => b.count - a.count);
  // A brand sits in one column only: luxury labels are listed under Luxury, not again under Popular or More.
  const regular = brands.filter((b) => !luxuryKeys.has(b.value.toLowerCase()));
  const popular = regular.slice(0, 8);
  const more = regular.slice(8, 16);
  const present = new Set(brands.map((b) => b.value.toLowerCase()));
  const luxury = LUXURY.filter((n) => present.has(n.toLowerCase())).map((n) => brands.find((b) => b.value.toLowerCase() === n.toLowerCase())!.value);
  const styles = STYLES.filter((_, i) => (checks[i]?.total ?? 0) > 0);
  const deals = DEALS.filter((_, i) => (checks[STYLES.length + i]?.total ?? 0) > 0);

  return (
    <nav aria-label="Browse shortcuts" className="mt-16 border-t-2 border-[#0A0A0A] pt-10">
      <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        <Column title="Popular brands">
          {popular.map((b) => (
            <Item key={b.value} to={href({ brand: b.value })}>
              {b.value}
            </Item>
          ))}
        </Column>
        <Column title="Most compared">
          {base.results.slice(0, 8).map((r) => (
            <Item key={`${r.brand}-${r.model}`} to={href({ q: `${r.brand} ${r.model}` })}>
              {r.brand} {r.model}
            </Item>
          ))}
        </Column>
        <Column title="More brands">
          {more.map((b) => (
            <Item key={b.value} to={href({ brand: b.value })}>
              {b.value}
            </Item>
          ))}
          <Item to="/brands">Explore all brands</Item>
        </Column>
        {luxury.length > 0 && (
          <Column title="Luxury brands">
            {luxury.map((n) => (
              <Item key={n} to={href({ brand: n })}>
                {n}
              </Item>
            ))}
          </Column>
        )}
      </div>

      <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {styles.length > 0 && (
          <Column title="Shop by style">
            {styles.map((s) => (
              <Item key={s.label} to={href(s.params)}>
                {s.label}
              </Item>
            ))}
          </Column>
        )}
        {deals.length > 0 && (
          <Column title="Steals &amp; deals">
            {deals.map((d) => (
              <Item key={d.label} to={href(d.params)}>
                {d.label}
              </Item>
            ))}
          </Column>
        )}
      </div>
    </nav>
  );
}
