import { Award } from 'lucide-react';
import { reputationTier } from './meta';

/**
 * Day 23, task 1's badge — reputation shown next to a username
 * everywhere one appears (post, comment, chat message). Three quiet
 * tiers by score; the tier name is in the tooltip and the number is
 * always printed, so colour is never the only carrier. Thresholds are
 * cosmetic only — LEGIT_CHECK_MIN_REPUTATION in apps/api is the one
 * place a real threshold lives.
 */
function tierClass(key: 'veteran' | 'established' | 'new'): string {
  if (key === 'veteran') return 'border-brass/45 bg-brass/10 text-brass-bright';
  if (key === 'established') return 'border-signal/35 bg-signal/[0.07] text-signal';
  return 'border-text/15 bg-text/[0.03] text-text-soft';
}

export function ReputationBadge({ score, className = '' }: { score: number; className?: string }) {
  const tier = reputationTier(score);
  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 py-[3px] font-mono text-[0.6875rem] font-semibold leading-none ${tierClass(tier.key)} ${className}`}
      title={`${tier.label} — ${score} reputation (account activity + vote quality, see /community-guidelines)`}
    >
      <Award className="h-3 w-3" aria-hidden />
      {score}
      <span className="sr-only"> reputation, {tier.label}</span>
    </span>
  );
}
