'use client';

import { useId, useState, type FormEvent } from 'react';
import { Input, buttonVariantClass } from '@chosn/ui';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [message, setMessage] = useState('');
  const emailId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');

    const res = await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const body = await res.json().catch(() => null);
    // Deliberately the same message on 200 and 429 — see the route's
    // own comment on why the "does this email exist" question never
    // gets a different answer from this form.
    setMessage(body?.message ?? "If that email has an account, we've sent a reset link.");
    setStatus('done');
  }

  if (status === 'done') {
    return <p className="max-w-[46ch] text-body text-text-soft">{message}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-[40ch] flex-col gap-4" noValidate>
      <div>
        <label htmlFor={emailId} className="block font-sans text-ui-label font-semibold uppercase text-text">
          Email
        </label>
        <Input
          id={emailId}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2"
        />
      </div>
      <button type="submit" disabled={status === 'submitting'} className={buttonVariantClass('primary')}>
        {status === 'submitting' ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}
