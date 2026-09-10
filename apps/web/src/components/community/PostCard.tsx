import Link from 'next/link';
import { AvatarIdenticon } from '@/components/AvatarIdenticon';
import { MarketIntelligenceCard } from '@/components/pricing/MarketIntelligenceCard';
import type { Post } from '@/lib/community';
import { CopOrDropBar } from './CopOrDropBar';
import { VoteButtons } from './VoteButtons';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const POST_TYPE_LABEL: Record<Post['postType'], string> = {
  price_check: 'Price Check',
  cop_or_drop: 'Cop or Drop',
  legit_check: 'Legit Check',
  drop_talk: 'Drop Talk',
};

/**
 * Task 4: one shared card shell (author, timestamp, vote/comment
 * controls) — each post type only supplies its own body content below
 * the header. Adding a fifth post type later means a new `case` in the
 * body switch, not a new card component that re-derives the header.
 */
export function PostCard({ post }: { post: Post }) {
  return (
    <article className="border border-moss/20 bg-vault-raised p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AvatarIdenticon seed={post.authorAvatarSeed} size={28} />
          <div>
            <p className="font-mono text-ui-label text-text">
              {post.authorDisplayName ?? `Collector ${post.authorUserId.slice(0, 4)}`}
            </p>
            <p className="font-mono text-meta text-text-faint">{timeAgo(post.createdAt)}</p>
          </div>
        </div>
        <span className="font-mono text-meta uppercase tracking-[0.08em] text-brass">
          {POST_TYPE_LABEL[post.postType]}
        </span>
      </header>

      <div className="mt-4">
        <PostBody post={post} />
      </div>

      <footer className="mt-4 flex items-center justify-between border-t border-moss/15 pt-3">
        <VoteButtons votableType="post" votableId={post.id} initialScore={post.voteScore} initialViewerVote={post.viewerVote} />
        <Link href={`/community/${post.id}`} className="font-mono text-meta text-text-faint hover:text-text">
          {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
        </Link>
      </footer>
    </article>
  );
}

function PostBody({ post }: { post: Post }) {
  switch (post.postType) {
    case 'price_check':
      return (
        <div className="flex flex-col gap-3">
          {post.sneaker && (
            <p className="font-editorial text-body font-semibold text-text">
              {post.sneaker.brand} {post.sneaker.model} — {post.sneaker.colorway}
            </p>
          )}
          {post.body && <p className="text-body text-text-soft">{post.body}</p>}
          <MarketIntelligenceCard data={post.marketIntelligence} bestRetailerName={null} />
        </div>
      );

    case 'cop_or_drop':
      return (
        <div>
          {post.sneaker && (
            <p className="font-editorial text-body font-semibold text-text">
              {post.title ?? `${post.sneaker.brand} ${post.sneaker.model} — ${post.sneaker.colorway}`}
            </p>
          )}
          {post.pollResults && <CopOrDropBar postId={post.id} initial={post.pollResults} />}
        </div>
      );

    case 'legit_check':
      return (
        <div className="flex flex-col gap-3">
          {post.title && <p className="font-editorial text-body font-semibold text-text">{post.title}</p>}
          {post.legitCheckChecklist && (
            <ul className="flex flex-wrap gap-2">
              {post.legitCheckChecklist.map((item) => {
                const answered = post.images?.some((img) => img.checklistItemId === item.id);
                return (
                  <li
                    key={item.id}
                    className={`border px-2 py-1 font-mono text-meta ${
                      answered ? 'border-signal/40 text-signal' : 'border-moss/30 text-text-faint'
                    }`}
                  >
                    {answered ? '✓ ' : ''}
                    {item.label}
                  </li>
                );
              })}
            </ul>
          )}
          {post.images && post.images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {post.images.map((img) => (
                <div key={img.id} className="relative aspect-square overflow-hidden border border-moss/20 bg-vault">
                  {img.classifierStatus === 'flagged' ? (
                    <div className="flex h-full items-center justify-center p-2 text-center font-mono text-meta text-rust">
                      Removed — flagged by review
                    </div>
                  ) : (
                    // Local disk-served upload — see PostImagesController's own comment; a plain <img>, not next/image, since this is served from apps/api's own origin (a different host than the web app), not a domain next/image is configured to optimize.
                    <img src={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}${img.url}`} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'drop_talk':
      return (
        <div>
          {post.title && <p className="font-editorial text-body font-semibold text-text">{post.title}</p>}
          {post.body && <p className="mt-1 text-body text-text-soft">{post.body}</p>}
          {post.dropEvent && (
            <Link href={`/drops/${post.dropEvent.id}`} className="mt-2 inline-block font-mono text-meta text-brass hover:underline">
              View drop →
            </Link>
          )}
        </div>
      );

    default:
      return null;
  }
}
