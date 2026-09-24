'use client';

import { useId, useState, type FormEvent } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Input, buttonVariantClass } from '@chosn/ui';
import { labelClass } from '@/components/auth/fields';
import { capture } from '@/lib/analytics';

// Mirrors apps/api/src/waitlist/dto/join-waitlist.dto.ts ALLOWED_INTERESTS —
// keep the two lists in sync; a mismatch here just means a chip the API
// would reject with "Unrecognized interest."
const INTERESTS = ['Jordan', 'Nike', 'Yeezy', 'Price alerts', 'Drop news'] as const;

type Status = 'idle' | 'submitting' | 'joined' | 'already-joined' | 'error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const emailId = useId();
  const statusId = useId();

  function toggleInterest(tag: string) {
    setInterests((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;

    setStatus('submitting');
    capture('waitlist_signup_started');

    try {
      const res = await fetch(`${API_URL}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, interests: interests.length ? interests : undefined }),
      });

      if (res.ok) {
        setStatus('joined');
        capture('waitlist_signup_completed', { interests });
        return;
      }

      const body = await res.json().catch(() => null);
      const message: string | undefined = Array.isArray(body?.message)
        ? body.message[0]
        : body?.message;

      if (res.status === 409) {
        setStatus('already-joined');
        setErrorMessage(message ?? "You're already on the list.");
        capture('waitlist_signup_failed', { reason: 'duplicate' });
        return;
      }

      if (res.status === 429) {
        setStatus('error');
        setErrorMessage(message ?? 'Too many attempts — try again in a bit.');
        capture('waitlist_signup_failed', { reason: 'rate_limited' });
        return;
      }

      setStatus('error');
      setErrorMessage(message ?? "That email looks invalid — double-check and try again.");
      capture('waitlist_signup_failed', { reason: 'validation', status: res.status });
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong on our end — try again in a moment.');
      capture('waitlist_signup_failed', { reason: 'network' });
    }
  }

  const joined = status === 'joined' || status === 'already-joined';

  if (joined) {
    return (
      <div role="status" id={statusId} className="panel ticks flex max-w-[46ch] items-start gap-4 px-6 py-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-signal/40 bg-signal/10 text-signal">
          <Check aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-xl font-bold text-text">
            {status === 'joined' ? "You're on the list." : "You're already on the list."}
          </p>
          <p className="mt-1 text-data-inline text-text-soft">
            We&apos;ll email you the moment early access opens — no spam before then.
          </p>
        </div>
      </div>
    );
  }

  const busy = status === 'submitting';
  return (
    <form onSubmit={handleSubmit} className="max-w-[46ch]" noValidate>
      <label htmlFor={emailId} className={labelClass}>
        Email address
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Input
          id={emailId}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={status === 'error' ? statusId : undefined}
          aria-invalid={status === 'error'}
          className="min-h-[48px] sm:flex-1"
        />
        <button type="submit" disabled={busy} className={buttonVariantClass('primary', 'min-h-[48px] sm:w-auto')}>
          {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
          {busy ? 'Joining…' : 'Notify me at launch'}
        </button>
      </div>

      <fieldset className="mt-5">
        <legend className={labelClass}>
          What should we tell you about? <span className="normal-case tracking-normal text-text-faint">(optional)</span>
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERESTS.map((tag) => {
            const selected = interests.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleInterest(tag)}
                className={
                  'min-h-[44px] rounded-chip border px-4 py-2 font-mono text-data-delta font-semibold transition-colors duration-150 ease-chosn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice ' +
                  (selected
                    ? 'border-brass-bright bg-brass-gradient text-vault-deep'
                    : 'border-text/15 bg-vault-raised/60 text-text-soft hover:border-brass/60 hover:text-text')
                }
              >
                {tag}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Live region stays mounted (empty) so screen readers announce the message when it appears. */}
      <div id={statusId} role="alert" className="mt-4 min-h-[1.25em]">
        {status === 'error' && (
          <p className="flex items-start gap-2 border border-rust/40 bg-rust/[0.08] px-3 py-2.5 text-data-inline text-rust">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </p>
        )}
      </div>
    </form>
  );
}
