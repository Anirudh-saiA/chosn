'use client';

import { useState } from 'react';
import { ArrowBigDown, ArrowBigUp } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { castVote } from '@/lib/community';

interface VoteButtonsProps {
  votableType: 'post' | 'comment';
  votableId: string;
  initialScore: number;
  initialViewerVote: 1 | -1 | null;
}

/** Shared upvote/downvote control every post card and comment uses (task 4's "shared card-shell controls"). Clicking the vote you already cast clears it — see VotesService.cast's own doc comment on `value: 0`. */
export function VoteButtons({ votableType, votableId, initialScore, initialViewerVote }: VoteButtonsProps) {
  const { data: session } = useSession();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const [score, setScore] = useState(initialScore);
  const [viewerVote, setViewerVote] = useState(initialViewerVote);
  const [busy, setBusy] = useState(false);

  async function cast(value: 1 | -1) {
    if (!apiToken || busy) return;
    setBusy(true);
    const nextValue = viewerVote === value ? 0 : value;
    const result = await castVote(apiToken, votableType, votableId, nextValue);
    if (result !== null) {
      setScore(result);
      setViewerVote(nextValue === 0 ? null : nextValue);
    }
    setBusy(false);
  }

  const base =
    'inline-flex h-11 w-11 items-center justify-center transition-all duration-150 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9';

  return (
    <div
      role="group"
      aria-label="Vote"
      title={apiToken ? undefined : 'Sign in to vote'}
      className="inline-flex items-center border border-text/10 bg-vault-deep/60 font-mono"
    >
      <button
        type="button"
        onClick={() => cast(1)}
        disabled={!apiToken || busy}
        aria-pressed={viewerVote === 1}
        aria-label="Upvote"
        className={`${base} ${
          viewerVote === 1 ? 'bg-brass/20 text-brass-bright' : 'text-text-soft hover:bg-text/[0.06] hover:text-text'
        }`}
      >
        <ArrowBigUp className={`h-5 w-5 ${viewerVote === 1 ? 'fill-current' : ''}`} aria-hidden />
      </button>
      <span
        className={`min-w-[3ch] px-1 text-center text-ui-label font-semibold tabular-nums ${
          viewerVote === 1 ? 'text-brass-bright' : viewerVote === -1 ? 'text-rust' : 'text-text'
        }`}
        aria-live="polite"
        aria-label={`Score ${score}`}
      >
        {score}
      </span>
      <button
        type="button"
        onClick={() => cast(-1)}
        disabled={!apiToken || busy}
        aria-pressed={viewerVote === -1}
        aria-label="Downvote"
        className={`${base} ${
          viewerVote === -1 ? 'bg-rust/20 text-rust' : 'text-text-soft hover:bg-text/[0.06] hover:text-text'
        }`}
      >
        <ArrowBigDown className={`h-5 w-5 ${viewerVote === -1 ? 'fill-current' : ''}`} aria-hidden />
      </button>
    </div>
  );
}
