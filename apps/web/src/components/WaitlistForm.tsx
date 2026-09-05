'use client';

import { useId, useState, type FormEvent } from 'react';
import posthog from 'posthog-js';
import { Input, buttonVariantClass, cx } from '@chosn/ui';

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
    posthog.capture('waitlist_signup_started');

    try {
      const res = await fetch(`${API_URL}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, interests: interests.length ? interests : undefined }),
      });

      if (res.ok) {
        setStatus('joined');
        posthog.capture('waitlist_signup_completed', { interests });
        return;
      }

      const body = await res.json().catch(() => null);
      const message: string | undefined = Array.isArray(body?.message)
        ? body.message[0]
        : body?.message;

      if (res.status === 409) {
        setStatus('already-joined');
        setErrorMessage(message ?? "You're already on the list.");
        posthog.capture('waitlist_signup_failed', { reason: 'duplicate' });
        return;
      }

      if (res.status === 429) {
        setStatus('error');
        setErrorMessage(message ?? 'Too many attempts — try again in a bit.');
        posthog.capture('waitlist_signup_failed', { reason: 'rate_limited' });
        return;
      }

      setStatus('error');
      setErrorMessage(message ?? "That email looks invalid — double-check and try again.");
      posthog.capture('waitlist_signup_failed', { reason: 'validation', status: res.status });
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong on our end — try again in a moment.');
      posthog.capture('waitlist_signup_failed', { reason: 'network' });
    }
  }

  const joined = status === 'joined' || status === 'already-joined';

  if (joined) {
    return (
      <div role="status" id={statusId} className="max-w-[46ch] border border-brass px-6 py-5">
        <p className="font-sans text-body font-semibold text-text-chalk">
          {status === 'joined'
            ? "You're on the list."
            : "You're already on the list."}
        </p>
        <p className="mt-1 text-data-inline text-text-chalk-soft">
          We'll email you the moment early access opens — no spam before then.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-[46ch]" noValidate>
      <label htmlFor={emailId} className="block font-sans text-ui-label font-semibold uppercase text-text-chalk">
        Email address
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Input
          id={emailId}
          type="email"
          name="email"
          surface="chalk"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={status === 'error' ? statusId : undefined}
          aria-invalid={status === 'error'}
          className="sm:flex-1"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className={buttonVariantClass('primary', 'sm:w-auto')}
        >
          {status === 'submitting' ? 'Joining…' : 'Notify me at launch'}
        </button>
      </div>

      <fieldset className="mt-5">
        <legend className="font-sans text-ui-label font-semibold uppercase text-text-chalk">
          What should we tell you about? <span className="normal-case text-text-chalk-soft">(optional)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTERESTS.map((tag) => {
            const selected = interests.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleInterest(tag)}
                className={
                  'rounded-chip border px-3 py-1.5 font-mono text-data-delta font-semibold transition-colors duration-150 ease-chosn ' +
                  (selected
                    ? 'border-brass bg-brass text-vault'
                    // Full-strength moss, not /40 — the lighter opacity
                    // used on Vault falls under 3:1 against Chalk's
                    // light ground.
                    : 'border-moss text-text-chalk-soft hover:border-text-chalk')
                }
              >
                {tag}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/*
        Rust marks the error as an accent (border), not as the text
        color — rust-on-chalk body text sits under 4.5:1, and Day 2's
        rule is that Rust stays non-decorative besides. The message
        itself reads in text-chalk, which has full contrast either way.
      */}
      <p
        id={statusId}
        role="alert"
        className={cx(
          'mt-3 min-h-[1.25em] text-data-inline text-text-chalk',
          status === 'error' && 'border-l-2 border-rust pl-2',
        )}
      >
        {status === 'error' ? errorMessage : ''}
      </p>
    </form>
  );
}
