'use client';

import { useId, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { Reveal } from '@/components/fx/Reveal';
import { capture } from '@/lib/analytics';
import { shoeById } from './shoes';

type Status = 'idle' | 'submitting' | 'joined' | 'already-joined' | 'error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Same /waitlist endpoint as the rest of the site: email in, one button out. */
export function SubscribeBand({ shoeId }: { shoeId: string }) {
  const s = shoeById(shoeId);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const emailId = useId();
  const statusId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    capture('waitlist_signup_started', { source: 'landing_band' });
    try {
      const res = await fetch(`${API_URL}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('joined');
        capture('waitlist_signup_completed', { source: 'landing_band' });
        return;
      }
      const body = await res.json().catch(() => null);
      const msg: string | undefined = Array.isArray(body?.message) ? body.message[0] : body?.message;
      if (res.status === 409) {
        setStatus('already-joined');
        setMessage(msg ?? "You're already on the list.");
        return;
      }
      setStatus('error');
      setMessage(msg ?? 'That email looks invalid — double-check and try again.');
    } catch {
      setStatus('error');
      setMessage('Something went wrong — try again in a moment.');
    }
  }

  const joined = status === 'joined' || status === 'already-joined';

  return (
    <section id="join" data-ambient={s.id} className="mx-auto w-full max-w-[90rem] px-5 pb-16 pt-8 sm:px-8" aria-labelledby="join-h">
      <Reveal>
        <div className="glass-card glass-card-lg relative grid items-center lg:grid-cols-2" style={{ background: s.bg, color: s.fg }}>
          <div className="relative min-h-[18rem] lg:min-h-[30rem]">
            <div className="shoe-float absolute inset-x-[8%] top-1/2 -translate-y-1/2">
              <img
                src={s.src}
                alt={s.alt}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="mx-auto h-auto w-[88%] select-none -rotate-6 drop-shadow-[0_24px_24px_rgba(0,0,0,0.5)]"
              />
            </div>
          </div>

          <div className="p-8 lg:p-16">
            <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.24em] opacity-90">Be first in</p>
            <h2 id="join-h" className="mt-3 font-display text-[clamp(3rem,6vw,5rem)] font-normal uppercase leading-[0.95] tracking-[0.01em]">
              join the waitlist.
            </h2>
            <p className="mt-5 max-w-md text-[1.02rem] font-semibold leading-relaxed opacity-90">
              Early access to drop chat rooms, legit checks and Cop-or-Drop votes.
            </p>

            {joined ? (
              <p role="status" className="mt-8 inline-flex items-center gap-3 rounded-full bg-white px-6 py-4 text-[0.95rem] font-extrabold text-[#14213D]">
                <Check className="h-5 w-5" aria-hidden />
                {status === 'joined' ? "You're on the list — we'll email you." : "You're already on the list."}
              </p>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row">
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
                  className="min-w-0 flex-1 rounded-full bg-white px-6 py-4 font-sans text-[0.95rem] font-bold text-[#14213D] outline-none placeholder:text-[#14213D]/50 focus:ring-4 focus:ring-white/40"
                />
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="btn-shine btn-shine-idle whitespace-nowrap rounded-full px-8 py-4 font-sans text-[0.74rem] font-extrabold uppercase tracking-[0.2em] shadow-[0_12px_24px_-12px_rgba(0,0,0,0.6)] disabled:opacity-60"
                  style={{ background: s.fg, color: s.bg }}
                >
                  {status === 'submitting' ? 'Joining…' : 'Submit'}
                </button>
              </form>
            )}
            <p id={statusId} role="alert" className="mt-3 min-h-[1.25em] text-sm font-bold">
              {status === 'error' || status === 'already-joined' ? message : ''}
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
