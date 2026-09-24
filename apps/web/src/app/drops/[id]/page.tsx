import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DropLiveProvider } from '@/components/drops/drop-live-context';
import { DropStatusBadge } from '@/components/drops/DropStatusBadge';
import { LivePricePreview } from '@/components/drops/LivePricePreview';
import { NotifyToggle } from '@/components/drops/NotifyToggle';
import { OfficialPurchaseLinks } from '@/components/drops/OfficialPurchaseLinks';
import { RaffleNotice } from '@/components/drops/RaffleNotice';
import { releaseInstant } from '@/components/drops/drop-instant';
import { Countdown } from '@/components/drops/drop-time';
import { SneakerPlaceholderArt } from '@/components/drops/SneakerPlaceholderArt';
import { SneakerViewer } from '@/components/ui/SneakerViewer';
import { PageShell } from '@/components/ui/PageShell';
import { Reveal } from '@/components/fx/Reveal';
import { paletteFor } from '@/lib/sneaker/palette';
import { ArrowLeft, ArrowRight, CalendarDays, Clock, MapPin, MessageSquare, Newspaper, Tag } from 'lucide-react';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { formatInr } from '@/lib/catalog';
import { listPosts } from '@/lib/community';
import { fetchDropDetail, fetchDropsList, formatRegions, formatReleaseTime, parsePurchaseLinks, parseRaffleInfo } from '@/lib/drops';
import { getChatRoomByDrop } from '@/lib/chat';
import { resolveSneakerImage } from '@/lib/resolve-sneaker-image';

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

/** Day 24 task 4 — existing Drop Talk discussion about this drop, not just a CTA to start one. Same revalidate window as the rest of this page. */
async function loadDropTalkPosts(dropEventId: string) {
  return listPosts({ postType: 'drop_talk', dropEventId, limit: 5 });
}

async function loadChatRoom(dropEventId: string) {
  // Same revalidate window as the rest of this page — the room's mere
  // existence (whether to render the widget at all) can be a few
  // minutes stale on first load; once mounted, ChatRoom's own
  // WebSocket keeps messages live regardless.
  return getChatRoomByDrop(dropEventId, { next: { revalidate: REVALIDATE_SECONDS } });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const drop = await loadDrop(id);
  if (!drop) return { title: 'Not found' };

  const { sneaker } = drop;
  return {
    title: `${sneaker.brand} ${sneaker.model} "${sneaker.colorway}" drop`,
    description: `${sneaker.brand} ${sneaker.model} "${sneaker.colorway}" (${sneaker.styleCode}) — release info, official retailer links${drop.status === 'live' ? ', and where it\'s already reselling' : ''}.`,
  };
}

export const revalidate = 300;

export default async function DropDetailPage({ params }: PageProps) {
  const { id } = await params;
  const drop = await loadDrop(id);
  if (!drop) notFound();
  const [chatRoom, dropTalkPosts] = await Promise.all([loadChatRoom(drop.id), loadDropTalkPosts(drop.id)]);

  const { sneaker } = drop;
  const purchaseLinks = parsePurchaseLinks(drop.purchaseLinks);
  const raffle = parseRaffleInfo(drop.raffleInfo);
  const regionText = formatRegions(drop.regions);

  const iso = releaseInstant(drop.releaseDate, drop.releaseTime, drop.releaseTimezone);
  const realImage = resolveSneakerImage(sneaker.primaryImageUrl);
  const palette = paletteFor(sneaker.colorway, sneaker.brand);
  const releaseDateLabel = new Date(`${drop.releaseDate}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const specs = [
    { icon: CalendarDays, label: 'Release date', value: releaseDateLabel },
    { icon: Clock, label: 'Time', value: drop.releaseTime ? `${formatReleaseTime(drop.releaseTime)} IST` : 'TBA' },
    { icon: MapPin, label: 'Regions', value: regionText || '—' },
    ...(drop.retailPrice ? [{ icon: Tag, label: 'Retail price', value: formatInr(Number(drop.retailPrice)) }] : []),
  ];

  return (
    <PageShell width="7xl">
      <DropLiveProvider>
        <Link
          href="/drops"
          className="mb-8 inline-flex min-h-[44px] items-center gap-2 font-mono text-meta uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-brass-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Drop calendar
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <Reveal>
            <div className="edge-glow ticks panel relative h-[320px] overflow-hidden sm:h-[420px] lg:sticky lg:top-24 lg:h-[560px]">
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: `radial-gradient(55% 60% at 50% 60%, ${palette.glow}55, transparent 75%)` }}
              />
              <div aria-hidden className="grid-lines absolute inset-0 opacity-40" />
              {realImage ? (
                <SneakerPlaceholderArt
                  brand={sneaker.brand}
                  model={sneaker.model}
                  colorway={sneaker.colorway}
                  imageUrl={realImage}
                  aspect="wide"
                  className="!absolute !inset-0 !aspect-auto h-full w-full !object-contain p-6"
                />
              ) : (
                <SneakerViewer brand={sneaker.brand} model={sneaker.model} colorway={sneaker.colorway} className="absolute inset-0" />
              )}
              <p className="pointer-events-none absolute left-4 top-4 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-brass sm:left-6 sm:top-6">
                {sneaker.styleCode}
              </p>
            </div>
          </Reveal>

          <div className="flex flex-col gap-8">
            <header>
              <Reveal>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-brass">{sneaker.brand}</p>
                  <DropStatusBadge dropEventId={drop.id} initialStatus={drop.status} />
                </div>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="mt-3 font-display text-[clamp(2.4rem,5.5vw,4rem)] font-bold leading-[0.98] tracking-tight text-text">
                  {sneaker.model}
                </h1>
                <p className="mt-2 text-xl text-text-soft">{sneaker.colorway}</p>
              </Reveal>
            </header>

            {drop.status === 'upcoming' && (
              <Reveal delay={0.1}>
                <p className="eyebrow mb-3 flex items-center gap-2">
                  <span className="live-dot text-rust" aria-hidden /> Drops in
                </p>
                <Countdown iso={iso} size="lg" />
              </Reveal>
            )}

            <Reveal delay={0.12}>
              <dl className="grid grid-cols-2 gap-px border border-text/[0.08] bg-text/[0.08]">
                {specs.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-vault-raised p-4">
                    <dt className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-faint">
                      <Icon className="h-3 w-3 text-brass" aria-hidden /> {label}
                    </dt>
                    <dd className="mt-1.5 font-mono text-data-inline text-text">{value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal delay={0.14}>
              <NotifyToggle brand={sneaker.brand} styleCode={sneaker.styleCode} modelLabel={`${sneaker.brand} ${sneaker.model}`} />
            </Reveal>

            <Reveal delay={0.16}>
              {raffle ? <RaffleNotice raffle={raffle} /> : <OfficialPurchaseLinks links={purchaseLinks} />}
            </Reveal>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-10 lg:mt-20">
          {drop.status === 'live' && drop.defaultVariant && (
            <LivePricePreview styleCode={sneaker.styleCode} size={drop.defaultVariant.size} />
          )}

          <div className="grid gap-10 lg:grid-cols-2">
            <section aria-labelledby="community-h">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 id="community-h" className="flex items-center gap-2 font-display text-2xl font-bold text-text">
                  <MessageSquare className="h-5 w-5 text-brass" aria-hidden /> Community
                </h2>
                <Link
                  href={`/community/new?type=drop_talk&dropEventId=${drop.id}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 font-mono text-meta text-brass-bright underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                >
                  Start a Drop Talk post <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
              {dropTalkPosts.length > 0 && (
                <ul className="mb-4 flex flex-col gap-2">
                  {dropTalkPosts.map((post) => (
                    <li key={post.id}>
                      <Link
                        href={`/community/${post.id}`}
                        className="panel flex min-h-[48px] items-center justify-between gap-3 px-4 py-3 text-body text-text transition-colors hover:bg-vault-high hover:text-brass-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                      >
                        <span>{post.title ?? '(untitled Drop Talk post)'}</span>
                        <span className="shrink-0 font-mono text-meta text-text-faint">
                          {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {chatRoom ? (
                <ChatRoom room={chatRoom} />
              ) : (
                <p className="panel px-4 py-5 text-meta text-text-soft">Live chat opens automatically an hour before release.</p>
              )}
            </section>

            <section aria-labelledby="coverage-h">
              <h2 id="coverage-h" className="mb-4 flex min-h-[44px] items-center gap-2 font-display text-2xl font-bold text-text">
                <Newspaper className="h-5 w-5 text-brass" aria-hidden /> Related coverage
              </h2>
              {drop.relatedNews.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {drop.relatedNews.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/news/${n.id}`}
                        className="panel group flex min-h-[48px] items-center justify-between gap-3 px-4 py-3 text-body text-text transition-colors hover:bg-vault-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                      >
                        <span className="group-hover:text-brass-bright">{n.title}</span>
                        {n.isBreaking && (
                          <span className="inline-flex shrink-0 items-center gap-1.5 border border-rust/50 bg-rust/10 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-rust">
                            <span className="live-dot !h-1.5 !w-1.5" aria-hidden /> Breaking
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel px-4 py-5 text-meta text-text-soft">No coverage yet — check back once this gets closer.</p>
              )}
            </section>
          </div>
        </div>
      </DropLiveProvider>
    </PageShell>
  );
}
