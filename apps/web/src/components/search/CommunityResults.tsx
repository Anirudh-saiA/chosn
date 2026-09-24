import Link from 'next/link';
import { ArrowUpRight, MessagesSquare } from 'lucide-react';
import { Reveal } from '@/components/fx/Reveal';
import type { CommunityPostSearchResult } from '@/lib/catalog';

const POST_TYPE_LABEL: Record<string, string> = {
  price_check: 'Price Check',
  cop_or_drop: 'Cop or Drop',
  legit_check: 'Legit Check',
  drop_talk: 'Drop Talk',
};

/**
 * A clearly separate, clearly labeled group under the sneaker results
 * grid, not merged into it: these are forum posts, not price pages.
 */
export function CommunityResults({ posts }: { posts: CommunityPostSearchResult[] }) {
  if (posts.length === 0) return null;

  return (
    <Reveal className="mt-16 border-t border-text/[0.08] pt-10">
      <div className="flex items-center gap-2.5">
        <MessagesSquare className="h-4 w-4 text-brass" aria-hidden />
        <h2 className="eyebrow">Community discussion</h2>
      </div>
      <ul className="mt-5 grid gap-px border border-text/[0.08] bg-text/[0.08] md:grid-cols-2">
        {posts.map((post) => (
          <li key={post.id} className="bg-vault">
            <Link
              href={`/community/${post.id}`}
              className="group flex h-full min-h-[44px] flex-col gap-1.5 p-5 transition-colors hover:bg-vault-high focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass-bright"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="border border-brass/30 bg-brass/[0.07] px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-brass-bright">
                    {POST_TYPE_LABEL[post.postType] ?? post.postType}
                  </span>
                  <span className="text-meta text-text-faint">{post.authorDisplayName ?? 'Collector'}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-text-faint transition-colors group-hover:text-brass-bright" aria-hidden />
              </span>
              <span className="line-clamp-2 text-body text-text">{post.preview}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
