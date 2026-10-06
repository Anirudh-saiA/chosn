import { CompareEditorial, CommunityStrip, CompareTiles, SplitBand } from '@/components/landing/Sections';
import { DropsBlock, type DropItem } from '@/components/landing/DropsBlock';
import { HeroSlider } from '@/components/landing/HeroSlider';
import { PageAmbient } from '@/components/landing/PageAmbient';
import { SourcesStrip } from '@/components/landing/SourcesStrip';
import { SubscribeBand } from '@/components/landing/SubscribeBand';
import { SHOES, type ShoePrice } from '@/components/landing/shoes';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { fetchSearch, formatInr, type SearchResultItem } from '@/lib/catalog';
import { fetchDropsList } from '@/lib/drops';

export const revalidate = 300;

const RETAILER_COUNT = 7;
const cache = { next: { revalidate: 300 } } as const;

async function loadCatalog() {
  try {
    const res = await fetchSearch({}, cache);
    return res.results;
  } catch {
    return [] as SearchResultItem[];
  }
}

async function loadDrops() {
  try {
    return await fetchDropsList({ status: ['live', 'upcoming'] }, cache);
  } catch {
    return [];
  }
}

/** Best live price + signal for a featured shoe, matched by keyword against the catalog (null = no match). */
function priceFor(catalog: SearchResultItem[], keyword: string): ShoePrice | null {
  const hit = catalog.find((c) => `${c.brand} ${c.model} ${c.colorway}`.toLowerCase().includes(keyword) && c.bestAvailablePrice != null);
  if (!hit) return null;
  return {
    price: formatInr(hit.bestAvailablePrice!),
    signal: hit.signal === 'good_time_to_buy' ? 'buy' : hit.signal === 'consider_waiting' ? 'wait' : null,
  };
}

export default async function HomePage() {
  const [catalog, dropList] = await Promise.all([loadCatalog(), loadDrops()]);

  const prices: Record<string, ShoePrice | null> = Object.fromEntries(SHOES.map((s) => [s.id, priceFor(catalog, s.keyword)]));

  const drops: DropItem[] = dropList
    .filter((d) => d.status !== 'sold_out')
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
    .map((d) => ({
      id: d.id,
      status: d.status,
      releaseAt: `${d.releaseDate.slice(0, 10)}T${(d.releaseTime ?? '00:00').slice(0, 5)}:00+05:30`,
      brand: d.sneaker.brand,
      model: d.sneaker.model,
      colourway: d.sneaker.colorway,
      retailPrice: d.retailPrice,
      currency: d.currency,
    }));

  return (
    <div className="isolate min-h-screen overflow-x-clip bg-[#F4F1EA] text-text [&_footer]:!mt-0 [&_footer]:!bg-[#E9E5DC] [&_header]:!bg-[#F4F1EA]/85">
      <PageAmbient />
      <Masthead />
      <main id="main">
        <HeroSlider retailerCount={RETAILER_COUNT} prices={prices} />
        <CompareTiles ids={['dunk', 'jordan', 'yeezy']} prices={prices} />
        <CompareEditorial shoeId="yeezy" />
        <SourcesStrip />
        <DropsBlock drops={drops} shoeId="syracuse" />
        <SplitBand shoeId="samba" />
        <CommunityStrip ids={['onitsuka', 'jordan', 'dunk', 'samba', 'syracuse']} />
        <SubscribeBand shoeId="onitsuka" />
      </main>
      <SiteFooter />
    </div>
  );
}
