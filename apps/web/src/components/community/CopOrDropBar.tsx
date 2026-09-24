'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { castPollVote, type PollResults } from '@/lib/community';

interface CopOrDropBarProps {
  postId: string;
  initial: PollResults;
}

/** Cop or Drop's own interaction (task 1) — two-option pick with a live split bar, not the generic up/down vote. */
export function CopOrDropBar({ postId, initial }: CopOrDropBarProps) {
  const { data: session } = useSession();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const [results, setResults] = useState(initial);
  const [busy, setBusy] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const inView = useInView(barRef, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();

  async function vote(choice: 'cop' | 'drop') {
    if (!apiToken || busy) return;
    setBusy(true);
    const next = await castPollVote(apiToken, postId, choice);
    if (next) setResults(next);
    setBusy(false);
  }

  const hasVotes = results.total > 0;
  const copPct = hasVotes ? Math.round((results.cop / results.total) * 100) : 50;
  const dropPct = 100 - copPct;
  const live = inView || reduce;
  const choice = results.viewerChoice;

  const btn =
    'group flex min-h-11 items-center justify-center gap-2 border font-sans text-ui-label font-semibold uppercase tracking-[0.08em] transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="mt-1">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => vote('cop')}
          disabled={!apiToken || busy}
          aria-pressed={choice === 'cop'}
          className={`${btn} ${
            choice === 'cop'
              ? 'border-signal bg-signal/15 text-signal shadow-glow-signal'
              : 'border-signal/35 bg-signal/[0.05] text-signal hover:bg-signal/10'
          }`}
        >
          <ThumbsUp className={`h-4 w-4 ${choice === 'cop' ? 'fill-current' : ''}`} aria-hidden />
          Cop
          {choice === 'cop' && <span className="font-mono text-[0.65rem] normal-case tracking-normal">· your pick</span>}
        </button>
        <button
          type="button"
          onClick={() => vote('drop')}
          disabled={!apiToken || busy}
          aria-pressed={choice === 'drop'}
          className={`${btn} ${
            choice === 'drop'
              ? 'border-rust bg-rust/15 text-rust shadow-glow-rust'
              : 'border-rust/35 bg-rust/[0.05] text-rust hover:bg-rust/10'
          }`}
        >
          <ThumbsDown className={`h-4 w-4 ${choice === 'drop' ? 'fill-current' : ''}`} aria-hidden />
          Drop
          {choice === 'drop' && <span className="font-mono text-[0.65rem] normal-case tracking-normal">· your pick</span>}
        </button>
      </div>

      <div
        ref={barRef}
        role="img"
        aria-label={hasVotes ? `Community: ${copPct}% cop (${results.cop}), ${dropPct}% drop (${results.drop})` : 'No votes yet'}
        className="mt-3 flex h-9 overflow-hidden border border-text/15 bg-vault-deep"
      >
        {hasVotes ? (
          <>
            <motion.div
              initial={reduce ? false : { width: 0 }}
              animate={{ width: live ? `${copPct}%` : 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="flex min-w-0 items-center overflow-hidden whitespace-nowrap bg-gradient-to-r from-signal/35 to-signal/15 pl-3 font-mono text-meta font-bold text-signal"
            >
              COP {copPct}%
            </motion.div>
            <div className="flex min-w-0 flex-1 items-center justify-end overflow-hidden whitespace-nowrap bg-gradient-to-l from-rust/35 to-rust/15 pr-3 font-mono text-meta font-bold text-rust">
              {dropPct}% DROP
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center font-mono text-meta text-text-soft">No votes yet</div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-meta text-text-soft">
        <span>
          <span className="text-signal">{results.cop}</span> cop · <span className="text-rust">{results.drop}</span> drop
        </span>
        <span>
          {results.total} vote{results.total === 1 ? '' : 's'}
        </span>
      </div>
      {!apiToken && (
        <p className="mt-2 text-meta text-text-soft">
          <Link href="/login" className="font-semibold text-brass-bright underline underline-offset-4">
            Sign in
          </Link>{' '}
          to cast your vote.
        </p>
      )}
    </div>
  );
}
