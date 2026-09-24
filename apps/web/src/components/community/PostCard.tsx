import Link from 'next/link';
import { ArrowUpRight, Check, CircleDashed, ImageOff, MessageSquare, Zap } from 'lucide-react';
import { Badge } from '@chosn/ui';
import { AvatarIdenticon } from '@/components/AvatarIdenticon';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { paletteFor } from '@/lib/sneaker/palette';
import { formatInr, SIGNAL_COPY } from '@/lib/catalog';
import type { Post } from '@/lib/community';
import { CopOrDropBar } from './CopOrDropBar';
import { POST_TYPE_META, timeAgo } from './meta';
import { ReportButton } from './ReportButton';
import { ReputationBadge } from './ReputationBadge';
import { VoteButtons } from './VoteButtons';

interface PostCardProps {
  post: Post;
  /** `feed` = compact card linking through to the thread; `detail` = the large thread header. */
  variant?: 'feed' | 'detail';
  /** Non-interactive rendering for the composer's live preview. */
  preview?: boolean;
}

/**
 * Task 4: one shared card shell (author, timestamp, vote/comment
 * controls) — each post type only supplies its own body content below
 * the header. Adding a fifth post type later means a new `case` in the
 * body switch, not a new card component that re-derives the header.
 */
export function PostCard({ post, variant = 'feed', preview = false }: PostCardProps) {
  const detail = variant === 'detail';
  const meta = POST_TYPE_META[post.postType];
  const Icon = meta.icon;
  const displayName = post.authorDisplayName ?? `Collector ${post.authorUserId.slice(0, 4)}`;
  const heading = post.title ?? (post.sneaker ? `${post.sneaker.brand} ${post.sneaker.model}` : meta.label);

  return (
    <article className="panel edge-glow group/card" inert={preview || undefined}>
      <div className={detail ? 'p-5 sm:p-8' : 'p-5 sm:p-6'}>
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/u/${post.authorUserId}`} aria-label={`${displayName}'s profile`} className="shrink-0">
              <AvatarIdenticon seed={post.authorAvatarSeed} size={detail ? 44 : 40} ring />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  href={`/u/${post.authorUserId}`}
                  className="truncate font-sans text-ui-label font-semibold text-text hover:text-brass-bright"
                >
                  {displayName}
                </Link>
                <ReputationBadge score={post.authorReputationScore} />
              </div>
              <time dateTime={post.createdAt} suppressHydrationWarning className="font-mono text-meta text-text-soft">
                {timeAgo(post.createdAt)}
              </time>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="inline-flex items-center gap-1.5 border border-brass/30 bg-brass/[0.07] px-2.5 py-1.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-brass-bright">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {meta.label}
            </span>
            {!preview && <ReportButton entityType="post" entityId={post.id} variant="button" />}
          </div>
        </header>

        <div className="mt-5">
          {detail ? (
            <h1 className="font-display text-[clamp(1.75rem,4.5vw,2.75rem)] font-bold leading-[1.05] tracking-tight text-text">
              {heading}
            </h1>
          ) : (
            <h3 className="font-display text-[1.65rem] font-bold leading-[1.1] tracking-tight text-text">
              <Link href={`/community/${post.id}`} className="transition-colors hover:text-brass-bright">
                {heading}
              </Link>
            </h3>
          )}
          {post.body && post.postType !== 'legit_check' && (
            <p className={`mt-3 max-w-[68ch] text-body text-text-soft ${detail ? '' : 'line-clamp-3'}`}>{post.body}</p>
          )}
        </div>

        <div className="mt-5">
          <PostBody post={post} detail={detail} />
        </div>

        <footer className="mt-6 flex items-center justify-between gap-3 border-t border-text/[0.08] pt-4">
          <VoteButtons
            votableType="post"
            votableId={post.id}
            initialScore={post.voteScore}
            initialViewerVote={post.viewerVote}
          />
          {detail ? (
            <span className="inline-flex items-center gap-2 font-mono text-ui-label text-text-soft">
              <MessageSquare className="h-4 w-4" aria-hidden />
              {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
            </span>
          ) : (
            <Link
              href={`/community/${post.id}`}
              className="inline-flex min-h-11 items-center gap-2 px-2 font-mono text-ui-label text-text-soft transition-colors hover:text-brass-bright"
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </footer>
      </div>
    </article>
  );
}

/** Sneaker chip: SneakerArt thumbnail on a colourway-tinted glow, name, and — when we have market data — price + signal. */
function SneakerChip({ post, detail }: { post: Post; detail: boolean }) {
  const s = post.sneaker;
  if (!s) return null;
  const p = paletteFor(s.colorway, s.brand);
  const mi = post.marketIntelligence;
  const signal = mi?.signal ? SIGNAL_COPY[mi.signal] : null;
  return (
    <div className="border border-text/10 bg-vault-deep/60">
      <div className="flex flex-wrap items-center gap-4 p-3 sm:flex-nowrap">
        <div
          className="relative flex h-[4.5rem] w-28 shrink-0 items-center justify-center overflow-hidden border border-text/[0.06]"
          style={{ background: `radial-gradient(75% 90% at 50% 45%, ${p.glow}38, transparent 80%), #0A0F0C` }}
        >
          <SneakerArt colorway={s.colorway} brand={s.brand} palette={p} className="h-full w-full p-1.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">{s.brand}</p>
          <p className="truncate font-display text-lg font-semibold leading-tight text-text">{s.model}</p>
          <p className="truncate text-meta text-text-soft">
            {s.colorway} · <span className="font-mono">{s.styleCode}</span>
            {post.variant && (
              <>
                {' '}
                · <span className="font-mono">
                  {post.variant.sizeSystem} {post.variant.size}
                </span>
              </>
            )}
          </p>
        </div>
        {mi?.currentPrice != null && (
          <div className="flex w-full items-center justify-between gap-3 border-t border-text/[0.08] pt-3 sm:w-auto sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <span className="font-mono text-2xl font-bold leading-none text-text">{formatInr(mi.currentPrice)}</span>
            {signal && <Badge state={signal.badge}>{signal.label}</Badge>}
          </div>
        )}
      </div>
      {detail && mi && (
        <dl className="grid grid-cols-2 divide-x divide-text/[0.08] border-t border-text/[0.08] sm:grid-cols-4">
          {[
            ['Best available', mi.bestAvailablePrice],
            ['30d average', mi.avg30d],
            ['90d average', mi.avg90d],
            ['30d trend', null],
          ].map(([label, value]) => (
            <div key={label as string} className="px-3 py-2.5">
              <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-text-soft">{label as string}</dt>
              <dd className="mt-0.5 font-mono text-data-inline font-semibold text-text">
                {label === '30d trend'
                  ? mi.trendPct != null
                    ? `${mi.trendPct > 0 ? '+' : ''}${mi.trendPct.toFixed(1)}%`
                    : '—'
                  : value != null
                    ? formatInr(value as number)
                    : '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <Link
        href={`/sneakers/${s.styleCode}`}
        className="flex min-h-11 items-center justify-between border-t border-text/[0.08] px-3 py-2 font-mono text-meta text-text-soft transition-colors hover:bg-text/[0.04] hover:text-brass-bright"
      >
        View live prices <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function PostBody({ post, detail }: { post: Post; detail: boolean }) {
  switch (post.postType) {
    case 'price_check':
      return <SneakerChip post={post} detail={detail} />;

    case 'cop_or_drop':
      return (
        <div className="flex flex-col gap-4">
          <SneakerChip post={post} detail={detail} />
          {post.pollResults && <CopOrDropBar postId={post.id} initial={post.pollResults} />}
        </div>
      );

    case 'legit_check':
      return (
        <div className="flex flex-col gap-4">
          {post.body && <p className="max-w-[68ch] text-body text-text-soft">{post.body}</p>}
          {post.legitCheckChecklist && post.legitCheckChecklist.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Checklist">
              {post.legitCheckChecklist.map((item) => {
                const answered = post.images?.some((img) => img.checklistItemId === item.id);
                return (
                  <li
                    key={item.id}
                    className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-meta ${
                      answered ? 'border-signal/40 bg-signal/[0.07] text-signal' : 'border-text/15 text-text-soft'
                    }`}
                  >
                    {answered ? <Check className="h-3.5 w-3.5" aria-hidden /> : <CircleDashed className="h-3.5 w-3.5" aria-hidden />}
                    {item.label}
                    <span className="sr-only">{answered ? ' — photo provided' : ' — no photo yet'}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {post.images && post.images.length > 0 && (
            <div className={`grid gap-2 ${detail ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3'}`}>
              {post.images.map((img) => {
                // Task 7's accessibility pass: these photos ARE a Legit
                // Check's content, not decoration — keep a real alt.
                const checklistLabel = post.legitCheckChecklist?.find((c) => c.id === img.checklistItemId)?.label;
                const altText = checklistLabel
                  ? `Legit Check photo: ${checklistLabel}`
                  : `Legit Check photo${post.title ? ` for ${post.title}` : ''}`;
                return (
                  <figure key={img.id} className="relative aspect-square overflow-hidden border border-text/10 bg-vault-recessed">
                    {img.classifierStatus === 'flagged' ? (
                      <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center font-mono text-meta text-rust">
                        <ImageOff className="h-5 w-5" aria-hidden />
                        Removed — flagged by review
                      </div>
                    ) : (
                      // Day 26: img.url is a full object-storage URL — plain <img>, not next/image (the bucket's domain isn't configured for optimization).
                      <img src={img.url} alt={altText} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
                    )}
                    {checklistLabel && img.classifierStatus !== 'flagged' && (
                      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6 font-mono text-[0.65rem] text-text">
                        {checklistLabel}
                      </figcaption>
                    )}
                  </figure>
                );
              })}
            </div>
          )}
        </div>
      );

    case 'drop_talk':
      return (
        <div className="flex flex-col gap-4">
          {post.sneaker && <SneakerChip post={post} detail={false} />}
          {post.dropEvent && (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-text/10 bg-vault-deep/60 px-3 py-2.5">
              <span className="inline-flex items-center gap-2 font-mono text-meta text-text-soft">
                {post.dropEvent.status === 'live' ? (
                  <span className="inline-flex items-center gap-2 font-semibold text-signal">
                    <span className="live-dot" aria-hidden /> LIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-brass-bright">
                    <Zap className="h-3.5 w-3.5" aria-hidden />
                    {post.dropEvent.status.toUpperCase()}
                  </span>
                )}
                <span>·</span>
                <span>drop {post.dropEvent.releaseDate}</span>
              </span>
              <Link
                href={`/drops/${post.dropEvent.id}`}
                className="inline-flex min-h-9 items-center gap-1.5 font-mono text-meta font-semibold text-brass-bright hover:underline"
              >
                View drop <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
}
