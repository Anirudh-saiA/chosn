'use client';

import { useId, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buttonVariantClass } from '@chosn/ui';
import { FormAlert, PasswordField, Spinner, TextField } from './fields';

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
      <PasswordField
        id={passwordId}
        label="Password"
        required
        minLength={10}
        autoComplete="new-password"
        hint="At least 10 characters. A passphrase works well."
        meter
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {/*
        Day 19 task 5 — the age statement and terms acceptance sit above
        the button, as a statement of what clicking it means, rather
        than as a pre-ticked checkbox. A pre-ticked box isn't valid
        consent under the DPDP Act (or GDPR), and an unticked box that
        blocks the button adds friction without adding legal weight
        beyond this — the action itself is the affirmative act.

        Not age-*verified* at v1, and the policy pages say so plainly.
        The under-13 line is what the DPDP Act's children's-data
        provisions hang on: below that, processing needs verifiable
        parental consent, which CHOSN doesn't implement, so those
        accounts simply aren't offered.
      */}
      <p className="border-l-2 border-brass/50 pl-3 text-meta leading-relaxed text-text-soft">
        You must be 13 or older to create a CHOSN account. By creating one you agree to our{' '}
        <Link href="/terms" className="text-brass-bright underline underline-offset-2">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-brass-bright underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>

      {error && <FormAlert>{error}</FormAlert>}

      <button type="submit" disabled={busy} className={buttonVariantClass('primary', 'min-h-[48px]')}>
        {busy && <Spinner />}
        {busy ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
