'use client';

import { useId, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { buttonVariantClass, Input } from '@chosn/ui';

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
      <div role="status" className="max-w-[46ch] border border-brass px-6 py-5">
        <p className="font-sans text-body font-semibold text-text">Got it — thank you.</p>
        <p className="mt-1 text-data-inline text-text-soft">
          Every one of these gets read during soft launch.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-[52ch] flex-col gap-5" noValidate>
      <fieldset>
        <legend className="font-sans text-ui-label font-semibold uppercase text-text">
          What&apos;s this about?
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={topic === t.value}
              onClick={() => setTopic(t.value)}
              className={
                'rounded-chip border px-3 py-1.5 font-mono text-data-delta font-semibold transition-colors duration-150 ease-chosn ' +
                (topic === t.value
                  ? 'border-brass bg-brass text-vault'
                  : 'border-moss/40 text-text-soft hover:border-text')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={messageId} className="block font-sans text-ui-label font-semibold uppercase text-text">
          {activePrompt}
        </label>
        <textarea
          id={messageId}
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          className="mt-2 w-full border border-moss/40 bg-vault-recessed px-3 py-2 text-body text-text placeholder:text-text-faint focus:border-brass focus:outline-none"
          placeholder="Be blunt."
        />
      </div>

      <div>
        <label htmlFor={emailId} className="block font-sans text-ui-label font-semibold uppercase text-text">
          Email <span className="normal-case text-text-faint">(optional — only if you want a reply)</span>
        </label>
        <Input
          id={emailId}
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="mt-2"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'submitting' || message.trim().length === 0}
        className={buttonVariantClass('primary', 'w-fit')}
      >
        {status === 'submitting' ? 'Sending…' : 'Send feedback'}
      </button>

      {error && (
        <p role="alert" className="text-data-inline text-rust">
          {error}
        </p>
      )}
    </form>
  );
}
