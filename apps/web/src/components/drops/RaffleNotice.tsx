import { ArrowUpRight, Ticket } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import type { RaffleInfo } from '@/lib/drops';

/** Raffle/draw releases change the primary action from "buy now" to "enter the raffle". */
export function RaffleNotice({ raffle }: { raffle: RaffleInfo }) {
  const closes = raffle.registration_closes_at
    ? new Date(raffle.registration_closes_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <div className="ticks relative overflow-hidden border border-brass/40 bg-gradient-to-br from-brass/[0.14] via-vault-raised to-vault-raised p-6 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brass/20 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-brass/40 bg-brass/10 text-brass-bright">
          <Ticket className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="eyebrow">Raffle release{raffle.method ? ` — ${raffle.method}` : ''}</p>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-text">This one is a draw, not a race.</h2>
          <p className="mt-2 max-w-[60ch] text-body text-text-soft">
            This isn't first-come-first-served. Entering the raffle doesn't
            guarantee a pair — it enters you into the retailer's own draw.
            {closes && (
              <>
                {' '}
                Registration closes <span className="font-mono text-text">{closes}</span>.
              </>
            )}
          </p>
          {raffle.registration_url && (
            <a href={raffle.registration_url} target="_blank" rel="noopener" className={buttonVariantClass('primary', 'mt-5 min-h-[44px]')}>
              Enter the raffle <ArrowUpRight className="h-4 w-4" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
