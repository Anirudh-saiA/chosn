'use client';

import { useId, useState, type FormEvent } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { Reveal } from '@/components/fx/Reveal';
import { capture } from '@/lib/analytics';

type Status = 'idle' | 'submitting' | 'joined' | 'already-joined' | 'error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Same /waitlist endpoint as the site's full WaitlistForm, stripped to
 * email + one button, staged over the big centred 3D sneaker.
 */
export function WaitlistMinimal() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const emailId = useId();
  const statusId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    capture('waitlist_signup_started', { source: 'landing_minimal' });

    try {
      const res = await fetch(`${API_URL}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus('joined');
        capture('waitlist_signup_completed', { source: 'landing_minimal' });
        return;
      }

      const body = await res.json().catch(() => null);
      const message: string | undefined = Array.isArray(body?.message) ? body.message[0] : body?.message;

      if (res.status === 409) {
        setStatus('already-joined');
        setErrorMessage(message ?? "You're already on the list.");
        return;
      }
      setStatus('error');
      setErrorMessage(message ?? 'That email looks invalid — double-check and try again.');
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong — try again in a moment.');
    }
  }

  const joined = status === 'joined' || status === 'already-joined';

  return (
    <section data-stage="cta" className="relative flex min-h-[110svh] flex-col items-center justify-end pb-24 pt-40" aria-labelledby="cta-h">
      <div className="mx-auto w-full max-w-2xl px-5 text-center sm:px-8">
        <Reveal>
          <p className="eyebrow">Be first in</p>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 id="cta-h" className="mt-4 font-display text-[clamp(2.6rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-tight text-text">
            The community <span className="text-brass-gradient">opens soon.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mx-auto mt-5 max-w-md text-lg text-text-soft">Join the waitlist for early access — drop chat rooms, legit checks and Cop-or-Drop votes.</p>
        </Reveal>

        <Reveal delay={0.18}>
          {joined ? (
            <p className="glass mx-auto mt-9 inline-flex items-center gap-3 px-6 py-4 text-ui-label font-semibold text-text" role="status">
              <span className="flex h-6 w-6 items-center justify-center bg-signal text-vault-deep">
                <Check className="h-4 w-4" aria-hidden />
              </span>
              {status === 'joined' ? "You're on the list — we'll email you." : "You're already on the list."}
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="mx-auto mt-9 flex max-w-lg flex-col gap-2 sm:flex-row">
              <label htmlFor={emailId} className="sr-only">
                Email address
              </label>
              <input
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
                className="glass min-w-0 flex-1 px-4 py-3.5 font-sans text-body text-text outline-none transition-all placeholder:text-text-faint focus:border-ice focus:shadow-[0_0_0_4px_rgba(143,214,255,.16)]"
              />
              <button type="submit" disabled={status === 'submitting'} className={buttonVariantClass('primary', 'whitespace-nowrap !py-3.5 px-6')}>
                {status === 'submitting' ? 'Joining…' : 'Join the waitlist'}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </form>
          )}
        </Reveal>

        <p id={statusId} role="alert" className="mt-3 min-h-[1.25em] text-sm text-rust">
          {status === 'error' || status === 'already-joined' ? errorMessage : ''}
        </p>
      </div>
    </section>
  );
}
