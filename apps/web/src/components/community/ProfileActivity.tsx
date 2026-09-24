'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, PenLine } from 'lucide-react';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import type { ActivityComment, Post } from '@/lib/community';
import { timeAgo } from './meta';
import { PostCard } from './PostCard';

/** Posts / Comments tabs for a public profile. Data is fetched server-side by the page; this only switches views. */
export function ProfileActivity({ posts, comments, name }: { posts: Post[]; comments: ActivityComment[]; name: string }) {
  const [tab, setTab] = useState<'posts' | 'comments'>('posts');
  const tabs = [
    { key: 'posts' as const, label: 'Posts', count: posts.length, icon: PenLine },
    { key: 'comments' as const, label: 'Comments', count: comments.length, icon: MessageSquare },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Activity" className="flex gap-1 border-b border-text/10">
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={on}
              aria-controls={`panel-${t.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') setTab(tab === 'posts' ? 'comments' : 'posts');
              }}
              className={`relative inline-flex min-h-11 items-center gap-2 px-4 font-sans text-ui-label font-semibold transition-colors ${
                on ? 'text-brass-bright' : 'text-text-soft hover:text-text'
              }`}
            >
              <t.icon className="h-4 w-4" aria-hidden />
              {t.label}
              <span className="font-mono text-[0.6875rem]">{t.count}</span>
              {on && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-brass-gradient" />}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
        {tab === 'posts' ? (
          posts.length === 0 ? (
            <EmptyPanel icon={<PenLine className="h-6 w-6" aria-hidden />} title="No posts yet">
              {name} hasn&apos;t started a thread.
            </EmptyPanel>
          ) : (
            <div className="flex flex-col gap-5">
              {[...posts]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
            </div>
          )
        ) : comments.length === 0 ? (
          <EmptyPanel icon={<MessageSquare className="h-6 w-6" aria-hidden />} title="No comments yet">
            {name} hasn&apos;t joined a discussion.
          </EmptyPanel>
        ) : (
          <ul className="flex flex-col gap-3">
            {[...comments]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/community/${c.postId}`}
                    className="panel edge-glow block border-l-2 border-l-brass/50 p-4 transition-colors hover:bg-vault-high/40"
                  >
                    <p className="flex flex-wrap items-center gap-x-2 font-mono text-meta text-text-soft">
                      <MessageSquare className="h-3.5 w-3.5 text-brass" aria-hidden />
                      <span>
                        on <span className="font-semibold text-text">{c.postTitle ?? 'a post'}</span>
                      </span>
                      <span aria-hidden>·</span>
                      <time dateTime={c.createdAt} suppressHydrationWarning>
                        {timeAgo(c.createdAt)}
                      </time>
                    </p>
                    <p className="mt-2 text-body text-text">{c.body}</p>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

