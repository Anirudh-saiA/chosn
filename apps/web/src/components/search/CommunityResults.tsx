import Link from 'next/link';
import type { CommunityPostSearchResult } from '@/lib/catalog';

const POST_TYPE_LABEL: Record<string, string> = {
  price_check: 'Price Check',
  cop_or_drop: 'Cop or Drop',
  legit_check: 'Legit Check',
  drop_talk: 'Drop Talk',
};

/**
 * Day 24 task 1 — a clearly separate, clearly labeled group under the
 * sneaker results grid, not merged into it: this is a forum post, not a
 * price comparison page, and the whole point of the task was "a user
 * should be able to tell at a glance" which one they're looking at.
 */
export function CommunityResults({ posts }: { posts: CommunityPostSearchResult[] }) {
  if (posts.length === 0) return null;

  return (
    <div className="mt-10 border-t border-moss/20 pt-8">
      <p className="font-mono text-ui-label uppercase tracking-[0.08em] text-text-faint">
        Community discussion
      </p>
      <ul className="mt-3 flex flex-col divide-y divide-moss/15 border-y border-moss/15">
        {posts.map((post) => (
          <li key={post.id} className="py-3">
            <Link href={`/community/${post.id}`} className="flex flex-col gap-0.5 hover:text-brass">
              <span className="flex items-center gap-2">
                <span className="font-mono text-meta uppercase tracking-[0.06em] text-brass">
                  {POST_TYPE_LABEL[post.postType] ?? post.postType}
                </span>
                <span className="text-meta text-text-faint">
                  {post.authorDisplayName ?? 'Collector'}
                </span>
              </span>
              <span className="text-body text-text">{post.preview}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
