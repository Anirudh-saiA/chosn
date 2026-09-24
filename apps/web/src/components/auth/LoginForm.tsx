'use client';

import { useId, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { buttonVariantClass } from '@chosn/ui';
import { FormAlert, GoogleGlyph, PasswordField, Spinner, TextField } from './fields';

type Status = 'idle' | 'submitting' | 'needs-totp' | 'error';

/**
 * Email/password + Google (task 1). The TOTP step (task 2) only ever
 * appears after a *correct* password — `auth.ts`'s `authorize()`
 * throws the same `totp_required` code whether the account has 2FA on
 * and no code was sent, or a code was sent and it was wrong, so this
 * form can't be used to probe "is 2FA even enabled" before the
 * password is right.
 */
export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const emailId = useId();
  const passwordId = useId();
  const totpId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      totpCode: status === 'needs-totp' ? totpCode : undefined,
      redirect: false,
    });

    if (result?.error === 'totp_required') {
      setStatus('needs-totp');
      setError(totpCode ? 'That code is wrong or expired.' : '');
      return;
    }
    if (result?.error === 'rate_limited') {
      setStatus('error');
      setError('Too many attempts — try again in a few minutes.');
      return;
    }
    if (result?.error) {
      setStatus('error');
      setError('Wrong email or password.');
      return;
    }

    router.push('/');
    router.refresh();
  }

  const busy = status === 'submitting';
  return (
    <div className="flex flex-col gap-6">
      {googleEnabled && (
        <>
          <button type="button" onClick={() => signIn('google', { callbackUrl: '/' })} className={buttonVariantClass('secondary', 'w-full min-h-[48px]')}>
            <GoogleGlyph />
            Continue with Google
          </button>
          <div className="flex items-center gap-3" aria-hidden>
            <div className="h-px flex-1 bg-text/10" />
            <span className="font-mono text-meta uppercase tracking-[0.2em] text-text-faint">or with email</span>
            <div className="h-px flex-1 bg-text/10" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <TextField
          id={emailId}
          label="Email"
          type="email"
          required
          autoComplete="email"
          disabled={status === 'needs-totp'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          id={passwordId}
          label="Password"
          required
          autoComplete="current-password"
          disabled={status === 'needs-totp'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {status === 'needs-totp' && (
          <TextField
            id={totpId}
            label="Authenticator code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            hint="The 6-digit code from your authenticator app."
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            className="font-mono tracking-[0.3em]"
          />
        )}

        {error && <FormAlert>{error}</FormAlert>}

        <button type="submit" disabled={busy} className={buttonVariantClass('primary', 'min-h-[48px]')}>
          {busy && <Spinner />}
          {busy ? 'Signing in…' : status === 'needs-totp' ? 'Verify code' : 'Sign in'}
        </button>
      </form>

      <p className="text-meta text-text-faint">
        <Link href="/forgot-password" className="link-underline inline-flex min-h-[44px] items-center text-text-soft hover:text-text">
          Forgot your password?
        </Link>
      </p>
    </div>
  );
}
