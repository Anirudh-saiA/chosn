import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
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
    <Reveal className="mt-16 border-t-2 border-[#0A0A0A] pt-8">
      <h2 className="font-display text-[clamp(1.8rem,3.4vw,2.8rem)] uppercase leading-none tracking-[0.02em] text-[#0A0A0A]">From the community</h2>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/community/${post.id}`}
              className="group flex h-full min-h-[44px] flex-col gap-3 rounded-3xl border border-[#0A0A0A]/10 bg-white p-6 transition-colors hover:border-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-3">
                  <span className="rounded-full bg-[#0A0A0A] px-3 py-1 font-display text-[0.8rem] uppercase tracking-[0.16em] text-white">
                    {POST_TYPE_LABEL[post.postType] ?? post.postType}
                  </span>
                  <span className="text-[0.85rem] font-bold text-[#0A0A0A]/55">{post.authorDisplayName ?? 'Collector'}</span>
                </span>
                <ArrowUpRight className="h-5 w-5 text-[#0A0A0A] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </span>
              <span className="line-clamp-2 text-[1.05rem] font-bold leading-snug text-[#0A0A0A]">{post.preview}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
