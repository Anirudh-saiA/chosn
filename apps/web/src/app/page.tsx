import { LandingHero, type HeroChip } from '@/components/landing/LandingHero';
import { LandingStage } from '@/components/landing/LandingStage';
import { CommunityTeaser } from '@/components/landing/CommunityTeaser';
import { DropsTeaser, type DropTeaserItem } from '@/components/landing/DropsTeaser';
import { MarketTerminal, type TerminalData } from '@/components/landing/MarketTerminal';
import { RetailerMarquee } from '@/components/landing/RetailerMarquee';
import { StorySteps } from '@/components/landing/StorySteps';
import { TrendingGrid } from '@/components/landing/TrendingGrid';
import { WaitlistMinimal } from '@/components/landing/WaitlistMinimal';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import {
  fetchCatalogVariant,
  fetchSearch,
  formatInr,
  SIGNAL_COPY,
  type CatalogResponse,
  type SearchResultItem,
} from '@/lib/catalog';
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

async function loadTerminal(item: SearchResultItem | undefined): Promise<TerminalData | null> {
  if (!item) return null;
  let detail: CatalogResponse | null = null;
  try {
    detail = await fetchCatalogVariant(item.styleCode, item.defaultSize, cache);
  } catch {
    detail = null;
  }
  const mi = detail?.marketIntelligence;
  if (!detail || !mi || mi.currentPrice == null) return null;
  const signal = mi.signal ? SIGNAL_COPY[mi.signal] : SIGNAL_COPY.insufficient_data;
  const offers = detail.offers
    .map((o) => ({
      retailer: o.retailerName,
      total: o.effectivePriceInr ?? o.price + o.shippingCost,
      inStock: o.inStock,
    }))
    .sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.total - b.total);
  return {
    name: `${item.brand} ${item.model}`,
    brand: item.brand,
    colorway: item.colorway,
    styleCode: item.styleCode,
    href: `/sneakers/${encodeURIComponent(item.styleCode)}/${item.defaultSize}`,
    current: mi.currentPrice,
    best: mi.bestAvailablePrice ?? mi.currentPrice,
    avg30: mi.avg30d ?? mi.currentPrice,
    avg90: mi.avg90d ?? mi.currentPrice,
    trendPct: mi.trendPct ?? 0,
    signalLabel: signal.label,
    signalState: signal.badge,
    offers,
  };
}

export default async function HomePage() {
  const [catalog, dropList] = await Promise.all([loadCatalog(), fetchDropsList({ status: ['live', 'upcoming'] }, cache)]);

  // Feature a sneaker that has a real buy signal; fall back to the first.
  const buys = catalog.filter((c) => c.signal === 'good_time_to_buy' && c.bestAvailablePrice != null);
  const featured = buys[0] ?? catalog.find((c) => c.bestAvailablePrice != null);
  const terminal = await loadTerminal(featured);

  const pool = (buys.length ? buys : catalog).filter((c) => c.bestAvailablePrice != null).slice(0, 3);
  const chips: HeroChip[] = pool.map((c, i) => {
    const label = `${c.brand} ${c.model}`;
    const price = formatInr(c.bestAvailablePrice!);
    if (i === 0 && terminal) {
      const d = terminal.trendPct;
      return { label, price, pill: { text: `${d <= 0 ? '▼' : '▲'} ${Math.abs(d).toFixed(1)}%`, tone: d <= 0 ? 'signal' : 'amber' } };
    }
    if (c.signal === 'good_time_to_buy') return { label, price, pill: { text: 'BUY', tone: 'signal' } };
    return { label, price, pill: { text: c.signal === 'consider_waiting' ? 'WAIT' : 'HOLD', tone: 'amber' } };
  });

  const drops: DropTeaserItem[] = dropList
    .filter((d) => d.status !== 'sold_out')
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
    .map((d) => ({
      id: d.id,
      status: d.status,
      releaseAt: `${d.releaseDate.slice(0, 10)}T${(d.releaseTime ?? '00:00').slice(0, 5)}:00+05:30`,
      brand: d.sneaker.brand,
      model: d.sneaker.model,
      colorway: d.sneaker.colorway,
      retailPrice: d.retailPrice,
      currency: d.currency,
    }));

  const pairs = catalog.slice(0, 8).map((c) => ({
    brand: c.brand,
    model: c.model,
    colorway: c.colorway,
    price: c.bestAvailablePrice != null ? formatInr(c.bestAvailablePrice) : 'Price pending',
  }));

  const trending = buys.length >= 4 ? buys : [...buys, ...catalog.filter((c) => !buys.includes(c))];

  return (
    <div className="page-shell">
      <div aria-hidden className="aurora fixed" />
      <div aria-hidden className="grid-lines fixed" />
      <LandingStage />
      <div className="relative z-10">
        <Masthead />
        <main id="main">
          <LandingHero catalogSize={catalog.length} retailerCount={RETAILER_COUNT} chips={chips} />
          <RetailerMarquee />
          <StorySteps />
          {terminal && <MarketTerminal data={terminal} />}
          <TrendingGrid items={trending} />
          <DropsTeaser drops={drops} />
          <CommunityTeaser pairs={pairs} />
          <WaitlistMinimal />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
