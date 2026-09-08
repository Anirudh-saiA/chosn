import Link from 'next/link';
import { relativeTime } from '@/lib/catalog';
import { excerpt, type NewsListItem } from '@/lib/news';
import { SneakerPlaceholderArt } from '@/components/drops/SneakerPlaceholderArt';

/** The denser grid below the feature story (task 2) — smaller, uniform, one of several rather than the one thing on the page. */
export function NewsCard({ item }: { item: NewsListItem }) {
  return (
    <Link href={`/news/${item.id}`} className="group flex h-full flex-col gap-3">
      <div className="w-full">
        {item.dropSneaker ? (
          <SneakerPlaceholderArt
            brand={item.dropSneaker.brand}
            model={item.dropSneaker.model}
            colorway=""
            aspect="wide"
          />
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center border border-moss/15 bg-vault-recessed">
            <span className="font-mono text-meta uppercase tracking-[0.1em] text-text-faint">CHOSN</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {item.isBreaking && (
          <p className="font-mono text-meta font-semibold uppercase tracking-[0.06em] text-brass">Breaking</p>
        )}
        <h3 className="font-display text-body font-semibold leading-snug text-text group-hover:text-brass">
          {item.title}
        </h3>
        <p className="text-meta text-text-soft">{excerpt(item.body, 100)}</p>
        <p className="mt-auto pt-1 font-mono text-meta text-text-faint">
          {item.source} · {relativeTime(item.publishedAt)}
        </p>
      </div>
    </Link>
  );
}
