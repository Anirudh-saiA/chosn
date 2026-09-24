'use client';

import { useId, useState, type FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { Spinner, TextField } from './fields';

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
    return (
      <div className="flex flex-col items-start gap-4">
        <span className="flex h-12 w-12 items-center justify-center border border-signal/40 bg-signal/10 text-signal shadow-glow-signal">
          <MailCheck aria-hidden className="h-6 w-6" />
        </span>
        <p role="status" className="max-w-[46ch] text-body text-text-soft">
          {message}
        </p>
      </div>
    );
  }

  const busy = status === 'submitting';
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <TextField
        id={emailId}
        label="Email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" disabled={busy} className={buttonVariantClass('primary', 'min-h-[48px]')}>
        {busy && <Spinner />}
        {busy ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}
