'use client';

import { useId, useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { capture } from '@/lib/analytics';

type Status = 'idle' | 'submitting' | 'joined' | 'already-joined' | 'error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Same /waitlist endpoint as the site's real WaitlistForm (community
 * intro), stripped to email + one button — "no interest-tag chips,
 * keep this screen as minimal as the hero," per the brief. Interests
 * stay collectible from the full form elsewhere; this entry point
 * trades that for restraint.
 */
export function WaitlistMinimal() {
  const prefersReducedMotion = useReducedMotion();
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
      setErrorMessage(message ?? "That email looks invalid — double-check and try again.");
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong — try again in a moment.');
    }
  }

  const joined = status === 'joined' || status === 'already-joined';

  return (
    <section className="bg-ember py-28 sm:py-36 lg:py-44">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-2xl px-6 text-center sm:px-10"
      >
        <h2 className="font-editorial text-3xl font-semibold leading-tight tracking-tight text-bone sm:text-4xl">
          Be first in when the community opens.
        </h2>

        {joined ? (
          <p className="mt-8 font-grotesk text-base text-bone/90">
            {status === 'joined' ? "You're on the list — we'll email you." : "You're already on the list."}
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row">
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
              className="flex-1 border border-bone/40 bg-transparent px-4 py-3 font-grotesk text-bone placeholder:text-bone/50 focus:border-bone focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="whitespace-nowrap border border-bone bg-bone px-6 py-3 font-grotesk text-sm font-medium uppercase tracking-[0.06em] text-ink transition-colors duration-200 hover:bg-transparent hover:text-bone"
            >
              {status === 'submitting' ? 'Joining…' : 'Join the waitlist'}
            </button>
          </form>
        )}

        <p id={statusId} role="alert" className="mt-3 min-h-[1.25em] font-grotesk text-sm text-bone">
          {status === 'error' ? errorMessage : ''}
        </p>
      </motion.div>
    </section>
  );
}
