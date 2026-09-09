import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { DropLiveProvider } from '@/components/drops/drop-live-context';
import { DropStatusBadge } from '@/components/drops/DropStatusBadge';
import { LivePricePreview } from '@/components/drops/LivePricePreview';
import { NotifyToggle } from '@/components/drops/NotifyToggle';
import { OfficialPurchaseLinks } from '@/components/drops/OfficialPurchaseLinks';
import { RaffleNotice } from '@/components/drops/RaffleNotice';
import { SneakerPlaceholderArt } from '@/components/drops/SneakerPlaceholderArt';
import { formatInr } from '@/lib/catalog';
import { fetchDropDetail, fetchDropsList, formatRegions, formatReleaseTime, parsePurchaseLinks, parseRaffleInfo } from '@/lib/drops';

interface PageProps {
  params: Promise<{ id: string }>;
}

const REVALIDATE_SECONDS = 300;

/**
 * Same Day 11 fix, same reason: without this, `next build` compiles
 * this route as `ƒ (Dynamic)` even with `revalidate` set — confirmed by
 * checking the actual `next build` output before adding this, not
 * assumed from the sneaker page's own history repeating. `dynamicParams`
 * stays at its default `true`, so a drop created after a deploy still
 * renders correctly on its first request.
 */
export async function generateStaticParams() {
  const drops = await fetchDropsList();
  return drops.map((d) => ({ id: d.id }));
}

async function loadDrop(id: string) {
  return fetchDropDetail(id, { next: { revalidate: REVALIDATE_SECONDS } });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const drop = await loadDrop(id);
  if (!drop) return { title: 'Not found | CHOSN' };

  const { sneaker } = drop;
  return {
    title: `${sneaker.brand} ${sneaker.model} "${sneaker.colorway}" drop | CHOSN`,
    description: `${sneaker.brand} ${sneaker.model} "${sneaker.colorway}" (${sneaker.styleCode}) — release info, official retailer links${drop.status === 'live' ? ', and where it\'s already reselling' : ''}.`,
  };
}

export const revalidate = 300;

export default async function DropDetailPage({ params }: PageProps) {
  const { id } = await params;
  const drop = await loadDrop(id);
  if (!drop) notFound();

  const { sneaker } = drop;
  const purchaseLinks = parsePurchaseLinks(drop.purchaseLinks);
  const raffle = parseRaffleInfo(drop.raffleInfo);
  const regionText = formatRegions(drop.regions);

  return (
    <main>
      <Masthead />
      <DropLiveProvider>
        <div className="mx-auto max-w-3xl px-6 py-10 lg:py-14">
          <div className="mb-8 aspect-[16/9] w-full">
            <SneakerPlaceholderArt
              brand={sneaker.brand}
              model={sneaker.model}
              colorway={sneaker.colorway}
              imageUrl={sneaker.primaryImageUrl}
              aspect="wide"
              className="h-full"
            />
          </div>

          <header className="mb-8">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-meta uppercase tracking-[0.08em] text-text-faint">
                {sneaker.styleCode}
              </p>
              <DropStatusBadge dropEventId={drop.id} initialStatus={drop.status} />
            </div>
            <h1 className="mt-1 font-display text-display-hero font-semibold leading-[1.05] text-text">
              {sneaker.brand} {sneaker.model}
            </h1>
            <p className="mt-1 text-body text-text-soft">{sneaker.colorway}</p>

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-moss/20 pt-5 sm:grid-cols-4">
              <div>
                <dt className="font-mono text-meta uppercase tracking-[0.06em] text-text-faint">Release date</dt>
                <dd className="mt-0.5 font-mono text-data-inline text-text">
                  {new Date(`${drop.releaseDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-meta uppercase tracking-[0.06em] text-text-faint">Time</dt>
                <dd className="mt-0.5 font-mono text-data-inline text-text">
                  {drop.releaseTime ? formatReleaseTime(drop.releaseTime) : 'TBA'}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-meta uppercase tracking-[0.06em] text-text-faint">Regions</dt>
                <dd className="mt-0.5 font-mono text-data-inline text-text">{regionText || '—'}</dd>
              </div>
              {drop.retailPrice && (
                <div>
                  <dt className="font-mono text-meta uppercase tracking-[0.06em] text-text-faint">Retail price</dt>
                  <dd className="mt-0.5 font-mono text-data-inline text-text">
                    {formatInr(Number(drop.retailPrice))}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-6">
              <NotifyToggle brand={sneaker.brand} styleCode={sneaker.styleCode} modelLabel={`${sneaker.brand} ${sneaker.model}`} />
            </div>
          </header>

          <div className="flex flex-col gap-6">
            {raffle ? <RaffleNotice raffle={raffle} /> : <OfficialPurchaseLinks links={purchaseLinks} />}

            {drop.status === 'live' && drop.defaultVariant && (
              <LivePricePreview styleCode={sneaker.styleCode} size={drop.defaultVariant.size} />
            )}

            {drop.relatedNews.length > 0 ? (
              <div>
                <p className="mb-2 font-mono text-meta uppercase tracking-[0.08em] text-text-faint">
                  Related coverage
                </p>
                <ul className="flex flex-col divide-y divide-moss/15 border-y border-moss/15">
                  {drop.relatedNews.map((n) => (
                    <li key={n.id} className="py-3">
                      <Link
                        href={`/news/${n.id}`}
                        className="flex items-center justify-between gap-3 text-body text-text hover:text-brass"
                      >
                        <span>{n.title}</span>
                        {n.isBreaking && (
                          <span className="shrink-0 font-mono text-meta uppercase tracking-[0.06em] text-brass">Breaking</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-meta text-text-faint">No coverage yet — check back once this gets closer.</p>
            )}
          </div>
        </div>
      </DropLiveProvider>
      <SiteFooter />
    </main>
  );
}
