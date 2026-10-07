import { CommunityStrip, CompareTiles, SplitBand } from '@/components/landing/Sections';
import { DropsBlock } from '@/components/landing/DropsBlock';
import { HeroSlider } from '@/components/landing/HeroSlider';
import { PageAmbient } from '@/components/landing/PageAmbient';
import { SourcesStrip } from '@/components/landing/SourcesStrip';
import { SubscribeBand } from '@/components/landing/SubscribeBand';
import { SHOES, type ShoePrice } from '@/components/landing/shoes';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { fetchSearch, formatInr, type SearchResultItem } from '@/lib/catalog';

export const revalidate = 300;

const cache = { next: { revalidate: 300 } } as const;

async function loadCatalog() {
  try {
    const res = await fetchSearch({}, cache);
    return res.results;
  } catch {
    return [] as SearchResultItem[];
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
  const catalog = await loadCatalog();

  const prices: Record<string, ShoePrice | null> = Object.fromEntries(SHOES.map((s) => [s.id, priceFor(catalog, s.keyword)]));

  return (
    <div className="isolate min-h-screen overflow-x-clip bg-white text-text [&_header]:!bg-white/85 [&_footer]:!mt-0 [&_footer]:!bg-[#F6F6F6]">
      <PageAmbient />
      <Masthead />
      <main id="main">
        <HeroSlider />
        <CompareTiles ids={['dunk', 'jordan', 'yeezy']} prices={prices} />
        <DropsBlock shoeId="syracuse" />
        <CommunityStrip ids={['onitsuka', 'jordan', 'dunk', 'samba', 'syracuse']} />
        <SourcesStrip />
        <SplitBand shoeId="samba" />
        <SubscribeBand shoeId="onitsuka" />
      </main>
      <SiteFooter />
    </div>
  );
}
