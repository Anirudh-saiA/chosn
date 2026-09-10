'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { castPollVote, type PollResults } from '@/lib/community';

interface CopOrDropBarProps {
  postId: string;
  initial: PollResults;
}

/** Cop or Drop's own interaction (task 1) — two-option pick with a live percentage bar, not the generic up/down vote. */
export function CopOrDropBar({ postId, initial }: CopOrDropBarProps) {
  const { data: session } = useSession();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const [results, setResults] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function vote(choice: 'cop' | 'drop') {
    if (!apiToken || busy) return;
    setBusy(true);
    const next = await castPollVote(apiToken, postId, choice);
    if (next) setResults(next);
    setBusy(false);
  }

  const copPct = results.total > 0 ? Math.round((results.cop / results.total) * 100) : 50;
  const dropPct = 100 - copPct;

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => vote('cop')}
          disabled={!apiToken || busy}
          className={`flex-1 border px-4 py-2 font-mono text-ui-label font-semibold uppercase tracking-[0.06em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
            results.viewerChoice === 'cop' ? 'border-signal bg-signal/10 text-signal' : 'border-moss/40 text-text hover:border-moss'
          }`}
        >
          Cop
        </button>
        <button
          type="button"
          onClick={() => vote('drop')}
          disabled={!apiToken || busy}
          className={`flex-1 border px-4 py-2 font-mono text-ui-label font-semibold uppercase tracking-[0.06em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
            results.viewerChoice === 'drop' ? 'border-rust bg-rust/10 text-rust' : 'border-moss/40 text-text hover:border-moss'
          }`}
        >
          Drop
        </button>
      </div>

      <div className="mt-2 flex h-2 w-full overflow-hidden border border-moss/20">
        <div className="bg-signal transition-all duration-300" style={{ width: `${copPct}%` }} />
        <div className="bg-rust transition-all duration-300" style={{ width: `${dropPct}%` }} />
      </div>
      <p className="mt-1 font-mono text-meta text-text-faint">
        {copPct}% cop · {dropPct}% drop · {results.total} vote{results.total === 1 ? '' : 's'}
      </p>
    </div>
  );
}
