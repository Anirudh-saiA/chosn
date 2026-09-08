'use client';

import { useId, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Input, buttonVariantClass } from '@chosn/ui';

type Status = 'idle' | 'submitting' | 'error';

/** Email/password sign-up (task 1). Google sign-in is a single click on the login page — no separate signup step exists for OAuth, since Auth.js creates the account automatically on first callback. */
export function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const emailId = useId();
  const passwordId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setError('');

    try {
      const res = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus('error');
        setError(body?.message ?? 'Something went wrong — try again.');
        return;
      }

      // Straight into a real session — no separate "check your email to
      // verify" gate for v1 (email verification exists as a schema
      // column, `emailVerified`, but isn't enforced yet; flagged as a
      // real gap in drops/README.md's Day 16 section, not silently
      // skipped).
      const signInResult = await signIn('credentials', { email, password, redirect: false });
      if (signInResult?.error) {
        // Account created but the immediate sign-in somehow failed —
        // send them to log in manually rather than leave them stuck.
        router.push('/login');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setStatus('error');
      setError('Something went wrong on our end — try again in a moment.');
    }
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
      <div>
        <label htmlFor={passwordId} className="block font-sans text-ui-label font-semibold uppercase text-text">
          Password
        </label>
        <Input
          id={passwordId}
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2"
        />
        <p className="mt-1 text-meta text-text-faint">At least 10 characters.</p>
      </div>

      <button type="submit" disabled={status === 'submitting'} className={buttonVariantClass('primary')}>
        {status === 'submitting' ? 'Creating account…' : 'Create account'}
      </button>

      {error && (
        <p role="alert" className="text-data-inline text-rust">
          {error}
        </p>
      )}
    </form>
  );
}
