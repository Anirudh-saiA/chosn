'use client';

import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { AvatarIdenticon } from '@/components/AvatarIdenticon';
import { buttonVariantClass } from '@chosn/ui';
import { createComment, type Comment } from '@/lib/community';
import { timeAgo } from './meta';
import { ReportButton } from './ReportButton';
import { ReputationBadge } from './ReputationBadge';

const MAX = 2000;

/** Legit Check's community "verdicts" render here too (task 2) — a comment thread is a comment thread regardless of what post type it hangs off. */
export function CommentThread({ postId, initialComments }: { postId: string; initialComments: Comment[] }) {
  const { data: session } = useSession();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const fieldId = useId();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!apiToken || !draft.trim() || busy) return;
    setBusy(true);
    setFailed(false);
    const comment = await createComment(apiToken, postId, draft.trim());
    if (comment) {
      setComments((prev) => [...prev, comment]);
      setDraft('');
    } else {
      setFailed(true);
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby={`${fieldId}-h`}>
      <div className="flex items-center gap-3">
        <h2 id={`${fieldId}-h`} className="font-display text-2xl font-bold text-text">
          Discussion
        </h2>
        <span className="border border-text/15 px-2 py-0.5 font-mono text-meta text-text-soft">
          {comments.length} comment{comments.length === 1 ? '' : 's'}
        </span>
      </div>

      {comments.length === 0 ? (
        <div className="panel mt-5 flex items-center gap-4 p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">
            <MessageSquare className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-text-soft">No replies yet. Add the first take.</p>
        </div>
      ) : (
        <ol className="relative mt-6">
          {/* thread rail: one continuous guide line running through the avatars */}
          <span aria-hidden className="absolute bottom-4 left-[19px] top-4 w-px bg-gradient-to-b from-brass/40 via-text/10 to-transparent" />
          {comments.map((c) => {
            const name = c.authorDisplayName ?? `Collector ${c.authorUserId.slice(0, 4)}`;
            return (
              <li key={c.id} className="relative flex gap-4 pb-6 last:pb-0">
                <Link href={`/u/${c.authorUserId}`} aria-label={`${name}'s profile`} className="relative z-10 shrink-0 self-start">
                  <AvatarIdenticon seed={c.authorAvatarSeed} size={40} className="border-2 border-vault-deep" ring />
                </Link>
                <div className="panel min-w-0 flex-1 px-4 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`/u/${c.authorUserId}`} className="text-ui-label font-semibold text-text hover:text-brass-bright">
                        {name}
                      </Link>
                      <ReputationBadge score={c.authorReputationScore} />
                      <time dateTime={c.createdAt} suppressHydrationWarning className="font-mono text-meta text-text-soft">
                        {timeAgo(c.createdAt)}
                      </time>
                    </div>
                    <ReportButton entityType="comment" entityId={c.id} variant="button" />
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-body text-text">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {apiToken ? (
        <form onSubmit={submit} className="panel mt-6 p-4 sm:p-5">
          <label htmlFor={fieldId} className="eyebrow">
            Add to the thread
          </label>
          <textarea
            id={fieldId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What's your take?"
            rows={3}
            maxLength={MAX}
            className="mt-3 w-full border border-text/15 bg-vault-deep/70 px-4 py-3 text-body text-text outline-none transition-all placeholder:text-text-faint hover:border-text/30 focus-visible:border-ice focus-visible:shadow-[0_0_0_3px_rgba(143,214,255,.18)]"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-meta text-text-soft">
              {draft.length}/{MAX}
            </span>
            <div className="flex items-center gap-3">
              {failed && (
                <span role="alert" className="font-mono text-meta text-rust">
                  Could not post — try again.
                </span>
              )}
              <button type="submit" disabled={!draft.trim() || busy} className={buttonVariantClass('primary')}>
                <Send className="h-4 w-4" aria-hidden />
                {busy ? 'Posting…' : 'Post comment'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="panel ticks mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="text-text-soft">Sign in to join the discussion.</p>
          <Link href="/login" className={buttonVariantClass('secondary')}>
            Sign in
          </Link>
        </div>
      )}
    </section>
  );
}
