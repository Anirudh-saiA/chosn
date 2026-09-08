import Link from 'next/link';
import { excerpt, type NewsListItem } from '@/lib/news';
import { relativeTime } from '@/lib/catalog';
import { SneakerPlaceholderArt } from '@/components/drops/SneakerPlaceholderArt';

/**
 * The top breaking story (task 2) — full-width, large display-face
 * headline, the one place on this page that gets `display-hero`
 * treatment. "Visually distinguished" per the brief means actual
 * layout prominence, not a badge on an otherwise-identical card: this
 * is a materially bigger, differently-composed block than
 * `NewsCard.tsx`, not the same card scaled up.
 */
export function NewsFeatureCard({ item }: { item: NewsListItem }) {
  return (
    <Link href={`/news/${item.id}`} className="group block">
      <article className="grid gap-6 border border-moss/20 bg-vault-raised sm:grid-cols-5">
        <div className="sm:col-span-2">
          {item.dropSneaker ? (
            <SneakerPlaceholderArt
              brand={item.dropSneaker.brand}
              model={item.dropSneaker.model}
              colorway=""
              aspect="wide"
              className="h-full border-0 border-b border-moss/20 sm:border-b-0 sm:border-r"
            />
          ) : (
            <div className="flex aspect-[16/9] items-center justify-center border-b border-moss/20 bg-vault-recessed sm:h-full sm:border-b-0 sm:border-r">
              <span className="font-mono text-meta uppercase tracking-[0.1em] text-text-faint">CHOSN</span>
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-3 p-6 sm:col-span-3 sm:py-8 sm:pr-8">
          <p className="font-mono text-meta font-semibold uppercase tracking-[0.08em] text-brass">Breaking</p>
          <h2 className="font-display text-display-section font-semibold leading-tight text-text group-hover:text-brass">
            {item.title}
          </h2>
          <p className="max-w-[60ch] text-body text-text-soft">{excerpt(item.body, 220)}</p>
          <p className="font-mono text-meta text-text-faint">
            {item.source} · {relativeTime(item.publishedAt)}
          </p>
        </div>
      </article>
    </Link>
  );
}
