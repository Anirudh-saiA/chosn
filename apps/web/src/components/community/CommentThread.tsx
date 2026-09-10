'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { AvatarIdenticon } from '@/components/AvatarIdenticon';
import { createComment, type Comment } from '@/lib/community';
import { ReputationBadge } from './ReputationBadge';

/** Legit Check's community "verdicts" render here too (task 2) — a comment thread is a comment thread regardless of what post type it hangs off. */
export function CommentThread({ postId, initialComments }: { postId: string; initialComments: Comment[] }) {
  const { data: session } = useSession();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!apiToken || !draft.trim() || busy) return;
    setBusy(true);
    const comment = await createComment(apiToken, postId, draft.trim());
    if (comment) {
      setComments((prev) => [...prev, comment]);
      setDraft('');
    }
    setBusy(false);
  }

  return (
    <div>
      <p className="font-mono text-ui-label uppercase tracking-[0.06em] text-text-faint">
        {comments.length} comment{comments.length === 1 ? '' : 's'}
      </p>

      <ul className="mt-3 flex flex-col gap-4">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <Link href={`/u/${c.authorUserId}`}>
              <AvatarIdenticon seed={c.authorAvatarSeed} size={24} />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <Link href={`/u/${c.authorUserId}`} className="font-mono text-meta text-text-faint hover:underline">
                  {c.authorDisplayName ?? `Collector ${c.authorUserId.slice(0, 4)}`}
                </Link>
                <ReputationBadge score={c.authorReputationScore} />
              </div>
              <p className="mt-0.5 text-body text-text">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>

      {apiToken ? (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            maxLength={2000}
            className="w-full border border-moss/30 bg-vault-raised px-3 py-2 text-body text-text placeholder:text-text-faint focus:border-brass focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || busy}
            className="self-end border border-brass bg-brass px-5 py-2 font-mono text-ui-label font-semibold text-vault transition-colors duration-150 hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Post comment
          </button>
        </form>
      ) : (
        <p className="mt-4 font-mono text-meta text-text-faint">Sign in to comment.</p>
      )}
    </div>
  );
}
