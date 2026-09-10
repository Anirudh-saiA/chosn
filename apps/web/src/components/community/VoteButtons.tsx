'use client';

import { useState } from 'react';
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

  return (
    <div className="flex items-center gap-1.5 font-mono text-meta">
      <button
        type="button"
        onClick={() => cast(1)}
        disabled={!apiToken || busy}
        aria-pressed={viewerVote === 1}
        aria-label="Upvote"
        className={`px-1.5 py-0.5 transition-colors duration-150 ${
          viewerVote === 1 ? 'text-brass' : 'text-text-faint hover:text-text'
        } disabled:cursor-not-allowed disabled:opacity-40`}
      >
        ▲
      </button>
      <span className="min-w-[2ch] text-center text-text">{score}</span>
      <button
        type="button"
        onClick={() => cast(-1)}
        disabled={!apiToken || busy}
        aria-pressed={viewerVote === -1}
        aria-label="Downvote"
        className={`px-1.5 py-0.5 transition-colors duration-150 ${
          viewerVote === -1 ? 'text-rust' : 'text-text-faint hover:text-text'
        } disabled:cursor-not-allowed disabled:opacity-40`}
      >
        ▼
      </button>
    </div>
  );
}
