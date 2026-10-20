import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { BreakingPill } from '@/components/news/BreakingPill';
import { PageShell } from '@/components/ui/PageShell';
import { relativeTime } from '@/lib/catalog';
import { CATEGORY_LABEL, excerpt, fetchNewsArticle, fetchNewsList } from '@/lib/news';

interface PageProps {
  params: Promise<{ id: string }>;
}

const REVALIDATE_SECONDS = 300;
const SERIF: CSSProperties = { fontFamily: 'var(--font-display), Georgia, "Times New Roman", serif', letterSpacing: '-0.01em', fontWeight: 700, textTransform: 'none' };

async function loadArticle(id: string) {
  return fetchNewsArticle(id, { next: { revalidate: REVALIDATE_SECONDS } });
}

/** Same Day 11/15 fix as the drop-detail page: without this the route renders as dynamic even with `revalidate` set. */
export async function generateStaticParams() {
  const { items } = await fetchNewsList({ limit: 50 });
  return items.map((item) => ({ id: item.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) return { title: 'Not found' };
  return { title: `${article.title}`, description: excerpt(article.body, 160) };
}

export const revalidate = 300;

/**
 * An article page, set like a newspaper. `body` is always CHOSN's own copy (or, for a gathered headline, the feed's short excerpt): nothing
 * here ever renders text fetched from the source page. A gathered headline shows its excerpt and sends the reader to the publisher.
 */
export default async function NewsArticlePage({ params }: PageProps) {
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) notFound();

  const brand = article.brands?.[0];
  const related = brand ? (await fetchNewsList({ limit: 6, brand, sort: 'relevance' }, { next: { revalidate: REVALIDATE_SECONDS } })).items.filter((i) => i.id !== article.id).slice(0, 4) : [];

  const paragraphs = article.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const [lede, ...rest] = paragraphs;
  const chip = 'rounded-full border border-[#0A0A0A]/15 bg-white px-3 py-1.5 font-mono text-[0.66rem] font-bold uppercase tracking-[0.1em] text-[#0A0A0A] transition-colors hover:border-[#0A0A0A]';

  return (
    <PageShell width="4xl">
      <Link href="/releases?tab=news" className="mx-auto mb-8 flex min-h-[44px] w-full max-w-[68ch] items-center gap-2 font-mono text-meta uppercase tracking-[0.14em] text-[#0A0A0A]/60 transition-colors hover:text-[#0A0A0A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice">
        <ArrowLeft className="h-4 w-4" aria-hidden /> The CHOSN Times
      </Link>

      <article className="text-[#0A0A0A]">
        <header className="mx-auto max-w-[68ch] border-t-[3px] border-double border-[#0A0A0A] pt-5">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em]">
            {article.isBreaking && <BreakingPill />}
            {article.category ? <span className="text-[#B3121F]">{CATEGORY_LABEL[article.category]}</span> : null}
            {(article.brands ?? []).slice(0, 3).map((b) => (
              <span key={b} className="text-[#0A0A0A]/55">{b}</span>
            ))}
          </div>
          <h1 style={SERIF} className="mt-4 text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.04]">
            {article.title}
          </h1>
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-[#0A0A0A]/20 py-3 font-mono text-[0.72rem] uppercase tracking-[0.1em] text-[#0A0A0A]/60">
            <span>By {article.source}</span>
            <span aria-hidden>·</span>
            <time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
            <span aria-hidden>·</span>
            <span>{relativeTime(article.publishedAt)}</span>
          </p>
        </header>

        <div className="mx-auto mt-9 max-w-[68ch]">
          {lede && (
            <p style={SERIF} className="text-[1.45rem] font-medium leading-[1.5] first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-[4.6rem] first-letter:leading-[0.8]">
              {lede}
            </p>
          )}
          {rest.map((para, i) => (
            <p key={i} className="mt-6 text-[1.1rem] leading-[1.85] text-[#0A0A0A]/80">
              {para}
            </p>
          ))}

          {article.external && article.sourceUrl ? (
            <p className="mt-8 border-l-[3px] border-[#0A0A0A] bg-white px-5 py-4 text-[0.95rem] text-[#0A0A0A]/70">
              This is a headline from {article.source}. The full story is at the publisher.{' '}
              <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-bold text-[#0A0A0A] underline underline-offset-4">
                Read at {article.source} <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            </p>
          ) : article.sourceUrl ? (
            <p className="mt-8 text-[0.85rem] text-[#0A0A0A]/55">
              Source:{' '}
              <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                {article.sourceUrl.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
              </a>
            </p>
          ) : null}

          {(article.shoeQuery || article.dropEventId) && (
            <aside aria-label="Related" className="mt-10 border-t-2 border-[#0A0A0A] pt-4">
              <p className="mb-3 font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">In this story</p>
              <div className="flex flex-wrap gap-2">
                {article.shoeQuery ? (
                  <Link href={`/sneakers?q=${encodeURIComponent(article.shoeQuery)}`} className={chip}>
                    Compare prices: {article.shoeQuery}
                  </Link>
                ) : null}
                {article.dropEventId ? (
                  <Link href={`/drops/${article.dropEventId}`} className={chip}>
                    {article.dropSneaker ? `View the drop: ${article.dropSneaker.model}` : 'View the drop'} <ArrowRight className="ml-1 inline h-3 w-3" aria-hidden />
                  </Link>
                ) : null}
              </div>
              {(article.alsoCoveredBy ?? []).length > 0 ? <p className="mt-3 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-[#0A0A0A]/50">Also covered by {(article.alsoCoveredBy ?? []).join(', ')}</p> : null}
            </aside>
          )}
        </div>

        {related.length > 0 && (
          <aside aria-label={`More ${brand} stories`} className="mx-auto mt-14 max-w-[68ch]">
            <p className="mb-3 border-b-2 border-[#0A0A0A] pb-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">More {brand} stories</p>
            <ul className="divide-y divide-[#0A0A0A]/15">
              {related.map((r) => (
                <li key={r.id} className="py-3">
                  {r.external ? (
                    <a href={r.sourceUrl ?? '#'} target="_blank" rel="noopener noreferrer nofollow" className="group block">
                      <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[#0A0A0A]/50">{r.source} · {relativeTime(r.publishedAt)}</span>
                      <span style={SERIF} className="mt-0.5 block text-[1.15rem] leading-[1.2] group-hover:underline">{r.title}</span>
                    </a>
                  ) : (
                    <Link href={`/news/${r.id}`} className="group block">
                      <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[#0A0A0A]/50">{r.source} · {relativeTime(r.publishedAt)}</span>
                      <span style={SERIF} className="mt-0.5 block text-[1.15rem] leading-[1.2] group-hover:underline">{r.title}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </article>
    </PageShell>
  );
}
