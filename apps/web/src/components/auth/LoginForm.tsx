'use client';

import { useId, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input, buttonVariantClass } from '@chosn/ui';

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

  return (
    <div className="flex max-w-[40ch] flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor={emailId} className="block font-sans text-ui-label font-semibold uppercase text-text">
            Email
          </label>
          <Input
            id={emailId}
            type="email"
            required
            autoComplete="email"
            disabled={status === 'needs-totp'}
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
            autoComplete="current-password"
            disabled={status === 'needs-totp'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2"
          />
        </div>

        {status === 'needs-totp' && (
          <div>
            <label htmlFor={totpId} className="block font-sans text-ui-label font-semibold uppercase text-text">
              Authenticator code
            </label>
            <Input
              id={totpId}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="mt-2"
            />
            <p className="mt-1 text-meta text-text-faint">The 6-digit code from your authenticator app.</p>
          </div>
        )}

        <button type="submit" disabled={status === 'submitting'} className={buttonVariantClass('primary')}>
          {status === 'submitting' ? 'Signing in…' : status === 'needs-totp' ? 'Verify code' : 'Sign in'}
        </button>

        {error && (
          <p role="alert" className="text-data-inline text-rust">
            {error}
          </p>
        )}
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-moss/20" />
            <span className="font-mono text-meta uppercase text-text-faint">or</span>
            <div className="h-px flex-1 bg-moss/20" />
          </div>

          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className={buttonVariantClass('secondary')}
          >
            Continue with Google
          </button>
        </>
      )}

      <p className="text-meta text-text-faint">
        <Link href="/forgot-password" className="underline decoration-moss/40 underline-offset-4 hover:text-text-soft">
          Forgot your password?
        </Link>
      </p>
    </div>
  );
}
