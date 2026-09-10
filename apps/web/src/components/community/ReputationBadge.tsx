/**
 * Day 23, task 1's badge — the differentiator called out in the brief
 * ("not just account age," unlike Reddit's raw karma number): shown
 * next to a username everywhere one appears (post, comment, chat
 * message), and on the profile page with its full breakdown. Three
 * quiet tiers by score, not a design element in themselves — a glance
 * at color tells "new," "established," or "veteran" faster than
 * reading the number, same "encode state in form as well as number"
 * instinct the rest of this app's status pills already follow. The
 * thresholds (15/50) are cosmetic only — they never gate anything;
 * LEGIT_CHECK_MIN_REPUTATION in apps/api's ReputationService is the
 * one place a real threshold lives.
 */
function tierClass(score: number): string {
  if (score >= 50) return 'border-brass/40 text-brass';
  if (score >= 15) return 'border-signal/40 text-signal';
  return 'border-moss/30 text-text-faint';
}

export function ReputationBadge({ score, className = '' }: { score: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-meta leading-none ${tierClass(score)} ${className}`}
      title={`${score} reputation — account activity + vote quality (see /community-guidelines)`}
    >
      {score}
      <span className="text-[0.65em] uppercase tracking-[0.06em] opacity-70">rep</span>
    </span>
  );
}
