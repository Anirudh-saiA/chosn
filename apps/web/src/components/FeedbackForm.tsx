'use client';

import { useId, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { Check, Send } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { FormAlert, Spinner, TextField, labelClass } from '@/components/auth/fields';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const TOPICS = [
  {
    value: 'price_trust',
    label: 'Prices',
    prompt: 'Did you believe the prices and the buy/wait signal? Did anything look wrong or out of date?',
  },
  {
    value: 'design_feel',
    label: 'Design & feel',
    prompt: 'How does it look and move? Anything slow, distracting, confusing, or broken on your device?',
  },
  {
    value: 'positioning',
    label: 'What CHOSN is',
    prompt: 'Was it clear that CHOSN doesn’t sell sneakers, and only compares prices and links out? Where did that get muddy?',
  },
  { value: 'other', label: 'Something else', prompt: 'Anything else at all.' },
] as const;

type Status = 'idle' | 'submitting' | 'sent' | 'error';

export function FeedbackForm() {
  const pathname = usePathname();
  const [topic, setTopic] = useState<(typeof TOPICS)[number]['value']>('price_trust');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const messageId = useId();
  const emailId = useId();

  const activePrompt = TOPICS.find((t) => t.value === topic)?.prompt ?? '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setError('');

    try {
      const res = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          message,
          contactEmail: contactEmail || undefined,
          sourcePath: pathname,
        }),
      });
      if (res.ok) {
        setStatus('sent');
        return;
      }
      const body = await res.json().catch(() => null);
      setStatus('error');
      setError(
        res.status === 429
          ? 'That’s a lot of feedback in one go — try again in a bit.'
          : (Array.isArray(body?.message) ? body.message[0] : body?.message) ??
              'Couldn’t send that — try again, or email hello@chosn.app.',
      );
    } catch {
      setStatus('error');
      setError('Couldn’t reach us — try again, or email hello@chosn.app.');
    }
  }

  if (status === 'sent') {
    return (
      <div role="status" className="flex flex-col items-start gap-4 py-4">
        <span className="flex h-14 w-14 items-center justify-center border border-signal/40 bg-signal/10 text-signal shadow-glow-signal">
          <Check aria-hidden className="h-7 w-7" />
        </span>
        <p className="font-display text-3xl font-bold text-text">Got it — thank you.</p>
        <p className="max-w-[46ch] text-body text-text-soft">Every one of these gets read during soft launch.</p>
      </div>
    );
  }

  const busy = status === 'submitting';
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <fieldset>
        <legend className={labelClass}>What&apos;s this about?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={topic === t.value}
              onClick={() => setTopic(t.value)}
              className={
                'min-h-[44px] rounded-chip border px-4 py-2 font-mono text-data-delta font-semibold transition-colors duration-150 ease-chosn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice ' +
                (topic === t.value
                  ? 'border-brass-bright bg-brass-gradient text-vault-deep'
                  : 'border-text/15 bg-vault-raised/60 text-text-soft hover:border-brass/60 hover:text-text')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={messageId} className="block text-body font-semibold leading-snug text-text">
          {activePrompt}
        </label>
        <textarea
          id={messageId}
          required
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          aria-describedby={`${messageId}-count`}
          className="mt-3 w-full border border-text/15 bg-vault-deep/70 px-4 py-3 text-body text-text outline-none transition-all duration-200 placeholder:text-text-faint hover:border-text/30 focus:border-ice focus:bg-vault-deep focus:shadow-[0_0_0_3px_rgba(143,214,255,.18)]"
          placeholder="Be blunt."
        />
        <p id={`${messageId}-count`} className="mt-1.5 text-right font-mono text-meta text-text-faint">
          {message.length} / 4000
        </p>
      </div>

      <TextField
        id={emailId}
        label="Email (optional, only if you want a reply)"
        type="email"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
      />

      {error && <FormAlert>{error}</FormAlert>}

      <button type="submit" disabled={busy || message.trim().length === 0} className={buttonVariantClass('primary', 'w-fit min-h-[48px]')}>
        {busy ? <Spinner /> : <Send aria-hidden className="h-4 w-4" />}
        {busy ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  );
}
