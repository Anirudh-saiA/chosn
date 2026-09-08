import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Masthead } from '@/components/Masthead';
import { relativeTime } from '@/lib/catalog';
import { fetchNewsArticle, fetchNewsList, excerpt } from '@/lib/news';

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
  if (!article) return { title: 'Not found | CHOSN' };
  return {
    title: `${article.title} | CHOSN`,
    description: excerpt(article.body, 160),
  };
}

export const revalidate = 300;

export default async function NewsArticlePage({ params }: PageProps) {
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) notFound();

  return (
    <main>
      <Masthead />
      {/*
        Editorial reading measure (Day 2's type scale): body copy holds
        to a 65-70ch line length rather than stretching to the page's
        usual max-width — a comparison table wants width, an article
        wants a comfortable line to read.
      */}
      <article className="mx-auto max-w-[70ch] px-6 py-10 lg:py-14">
        {article.dropSneaker && (
          <p className="mb-4 font-mono text-meta uppercase tracking-[0.06em] text-text-faint">
            <Link href={`/drops/${article.dropEventId}`} className="text-brass hover:underline">
              {article.dropSneaker.brand} {article.dropSneaker.model}
            </Link>
          </p>
        )}

        {article.isBreaking && (
          <p className="mb-2 font-mono text-meta font-semibold uppercase tracking-[0.08em] text-brass">Breaking</p>
        )}

        <h1 className="font-display text-display-hero font-semibold leading-[1.05] text-text">
          {article.title}
        </h1>

        {/* Byline/source attribution + timestamp (task 4) — 'CHOSN (auto)'
            vs 'CHOSN editorial' is a real, meaningful distinction (see
            apps/api/src/drops/auto-post-template.ts's own comment), so
            it's shown verbatim rather than collapsed to a generic
            "CHOSN" byline. */}
        <p className="mt-4 font-mono text-meta text-text-faint">
          {article.source}
          {article.sourceUrl && (
            <>
              {' '}
              ·{' '}
              <a href={article.sourceUrl} target="_blank" rel="noopener" className="underline decoration-moss/40 underline-offset-4 hover:text-text-soft">
                original source
              </a>
            </>
          )}
          {' · '}
          <time dateTime={article.publishedAt}>{relativeTime(article.publishedAt)}</time>
        </p>

        {/*
          `body` is always CHOSN's own copy, never licensed article text
          — the schema itself enforces this (see NewsItem's design in
          apps/api/src/drops/README.md's content-sourcing section):
          `source_url` is where a licensed *fact* was verified, `body`
          is written here regardless. Nothing in this page ever renders
          content fetched from `sourceUrl` as body text.
        */}
        <div className="mt-8 whitespace-pre-line text-body leading-[1.75] text-text-soft">
          {article.body}
        </div>

        {article.dropEventId && (
          <div className="mt-10 border-t border-moss/20 pt-6">
            <Link
              href={`/drops/${article.dropEventId}`}
              className="font-mono text-ui-label font-semibold text-brass hover:underline"
            >
              View this drop →
            </Link>
          </div>
        )}
      </article>
    </main>
  );
}
