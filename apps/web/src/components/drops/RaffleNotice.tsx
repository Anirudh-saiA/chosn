import type { RaffleInfo } from '@/lib/drops';

/** Raffle/draw releases change the primary action from "buy now" to "enter the raffle" — Day 12's schema note, made visible. */
export function RaffleNotice({ raffle }: { raffle: RaffleInfo }) {
  const closes = raffle.registration_closes_at
    ? new Date(raffle.registration_closes_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <div className="border border-brass/40 bg-brass/[0.06] p-5 sm:p-6">
      <p className="font-mono text-meta uppercase tracking-[0.08em] text-brass">
        Raffle release{raffle.method ? ` — ${raffle.method}` : ''}
      </p>
      <p className="mt-2 text-body text-text-soft">
        This isn't first-come-first-served. Entering the raffle doesn't
        guarantee a pair — it enters you into the retailer's own draw.
        {closes && ` Registration closes ${closes}.`}
      </p>
      {raffle.registration_url && (
        <a
          href={raffle.registration_url}
          target="_blank"
          rel="noopener"
          className="mt-3 inline-flex items-center gap-1.5 font-sans text-body font-medium text-text underline decoration-brass underline-offset-4 hover:text-brass"
        >
          Enter the raffle <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  );
}
