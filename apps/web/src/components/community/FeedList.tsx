'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, MessageSquarePlus } from 'lucide-react';
import { Reveal } from '@/components/fx/Reveal';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { buttonVariantClass } from '@chosn/ui';
import type { Post, PostType } from '@/lib/community';
import { POST_TYPE_META } from './meta';
import { PostCard } from './PostCard';

type Filter = 'all' | PostType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'price_check', label: 'Price check' },
  { value: 'cop_or_drop', label: 'Cop or drop' },
  { value: 'legit_check', label: 'Legit check' },
  { value: 'drop_talk', label: 'Drop talk' },
];

/** Post-type filter (pill tabs) + the card list. Filters the already-fetched page client-side — no extra requests. */
export function FeedList({ posts, signedIn }: { posts: Post[]; signedIn: boolean }) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length };
    for (const p of posts) c[p.postType] = (c[p.postType] ?? 0) + 1;
    return c;
  }, [posts]);

  const visible = filter === 'all' ? posts : posts.filter((p) => p.postType === filter);

  return (
    <div>
      <div role="group" aria-label="Filter posts by type" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const Icon = f.value === 'all' ? LayoutGrid : POST_TYPE_META[f.value].icon;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.value)}
              className={`inline-flex min-h-11 items-center gap-2 border px-3.5 font-sans text-ui-label font-semibold transition-all duration-200 sm:min-h-10 ${
                active
                  ? 'border-brass/60 bg-brass/15 text-brass-bright shadow-glow-brass'
                  : 'border-text/15 bg-vault-raised/50 text-text-soft hover:border-text/30 hover:text-text'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {f.label}
              <span className={`font-mono text-[0.6875rem] ${active ? 'text-brass-bright' : 'text-text-soft'}`}>
                {counts[f.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-5" aria-live="polite">
        {visible.length === 0 ? (
          <EmptyPanel
            icon={<MessageSquarePlus className="h-6 w-6" aria-hidden />}
            title={filter === 'all' ? 'Nothing posted yet' : `No ${POST_TYPE_META[filter].short.toLowerCase()} posts yet`}
            action={
              signedIn ? (
                <Link href="/community/new" className={buttonVariantClass('primary')}>
                  Start a post
                </Link>
              ) : (
                <Link href="/login" className={buttonVariantClass('secondary')}>
                  Sign in to post
                </Link>
              )
            }
          >
            Be the first — the community is only as good as the people who show up.
          </EmptyPanel>
        ) : (
          visible.map((post, i) => (
            <Reveal key={`${filter}-${post.id}`} delay={Math.min(i, 3) * 0.06} y={18}>
              <PostCard post={post} />
            </Reveal>
          ))
        )}
      </div>
    </div>
  );
}
