import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { BreakingPill } from '@/components/news/BreakingPill';
import { Reveal } from '@/components/fx/Reveal';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { PageShell } from '@/components/ui/PageShell';
import { relativeTime } from '@/lib/catalog';
import { fetchNewsArticle, fetchNewsList, excerpt } from '@/lib/news';
import { paletteFor } from '@/lib/sneaker/palette';

interface PageProps {
  params: Promise<{ id: string }>;
}

const REVALIDATE_SECONDS = 300;

async function loadArticle(id: string) {
  return fetchNewsArticle(id, { next: { revalidate: REVALIDATE_SECONDS } });
}

/** Same Day 11/15 fix as the drop-detail page — see its own comment. */
export async function generateStaticParams() {
  const { items } = await fetchNewsList({ limit: 1000 });
  return items.map((item) => ({ id: item.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) return { title: 'Not found' };
  return {
    title: `${article.title}`,
    description: excerpt(article.body, 160),
  };
}

export const revalidate = 300;

export default async function NewsArticlePage({ params }: PageProps) {
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) notFound();

  // `body` is always CHOSN's own copy, never licensed article text — the
  // schema enforces this (see apps/api/src/drops/README.md's content-
  // sourcing section): `source_url` is where a licensed *fact* was
  // verified, `body` is written here regardless. Nothing on this page ever
  // renders content fetched from `sourceUrl` as body text.
  const paragraphs = article.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const [lede, ...restParagraphs] = paragraphs;
  const p = article.dropSneaker ? paletteFor('', article.dropSneaker.brand) : null;

  return (
    <PageShell width="4xl">
      <Link
        href="/news"
        className="mx-auto mb-8 flex w-full max-w-[68ch] min-h-[44px] items-center gap-2 font-mono text-meta uppercase tracking-[0.14em] text-text-soft transition-colors hover:text-brass-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All news
      </Link>

      <article>
        <header className="mx-auto max-w-[68ch]">
          <Reveal>
            <div className="flex flex-wrap items-center gap-3">
              {article.isBreaking && <BreakingPill />}
              {article.dropSneaker && (
                <Link
                  href={`/drops/${article.dropEventId}`}
                  className="eyebrow inline-flex min-h-[32px] items-center underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                >
                  {article.dropSneaker.brand} {article.dropSneaker.model}
                </Link>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mt-5 font-display text-[clamp(2.2rem,5.5vw,3.75rem)] font-bold leading-[1.02] tracking-tight text-text">
              {article.title}
            </h1>
          </Reveal>

          {/* Byline/source attribution + timestamp — 'CHOSN (auto)' vs 'CHOSN
              editorial' is a real, meaningful distinction (see
              apps/api/src/drops/auto-post-template.ts), so it's shown
              verbatim rather than collapsed to a generic "CHOSN". */}
          <Reveal delay={0.1}>
            <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-text/[0.08] py-3 font-mono text-meta text-text-faint">
              <span className="text-text-soft">{article.source}</span>
              <span aria-hidden>·</span>
              <time dateTime={article.publishedAt}>{relativeTime(article.publishedAt)}</time>
              {article.sourceUrl && (
                <>
                  <span aria-hidden>·</span>
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex min-h-[32px] items-center gap-1 text-brass-bright underline decoration-brass/40 underline-offset-4 hover:decoration-brass-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                  >
                    original source <ExternalLink className="h-3 w-3" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </>
              )}
            </p>
          </Reveal>
        </header>

        <Reveal delay={0.14}>
          <div className="mx-auto mt-10 max-w-[68ch]">
            {lede && (
              <p className="font-display text-[1.375rem] font-medium leading-[1.55] text-text first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-display first-letter:text-[4.5rem] first-letter:font-bold first-letter:leading-[0.8] first-letter:text-brass-bright">
                {lede}
              </p>
            )}
            {restParagraphs.map((para, i) => (
              <p key={i} className="mt-6 text-lg leading-[1.8] text-text-soft">
                {para}
              </p>
            ))}
          </div>
        </Reveal>

        {article.dropEventId && article.dropSneaker && p && (
          <Reveal delay={0.05}>
            <aside aria-label="Related drop" className="mx-auto mt-14 max-w-[68ch]">
              <p className="eyebrow mb-3">Related drop</p>
              <Link
                href={`/drops/${article.dropEventId}`}
                className="edge-glow ticks panel group flex items-stretch overflow-hidden transition-colors hover:bg-vault-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <div className="relative w-36 shrink-0 border-r border-text/[0.08] bg-vault-deep/70 sm:w-52">
                  <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(60% 70% at 50% 65%, ${p.glow}50, transparent 75%)` }} />
                  <SneakerArt colorway="" brand={article.dropSneaker.brand} palette={p} className="absolute inset-0 m-auto h-[80%] w-[85%]" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-5">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">{article.dropSneaker.brand}</p>
                  <p className="font-display text-xl font-bold leading-tight text-text group-hover:text-brass-bright">
                    {article.dropSneaker.model}
                  </p>
                  <p className="font-mono text-meta text-text-faint">{article.dropSneaker.styleCode}</p>
                  <span className={buttonVariantClass('ghost', 'mt-2 w-fit !px-0 !py-1 text-brass-bright')}>
                    View this drop <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </Link>
            </aside>
          </Reveal>
        )}
      </article>
    </PageShell>
  );
}
