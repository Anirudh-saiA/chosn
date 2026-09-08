'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input, buttonVariantClass } from '@chosn/ui';

export function ResetPasswordForm({ email, token }: { email: string; token: string }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState('');
  const passwordId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');

    const res = await fetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, newPassword }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setStatus('error');
      setError(body?.message ?? 'Something went wrong — try again.');
      return;
    }

    router.push('/login');
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-[40ch] flex-col gap-4" noValidate>
      <div>
        <label htmlFor={passwordId} className="block font-sans text-ui-label font-semibold uppercase text-text">
          New password
        </label>
        <Input
          id={passwordId}
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-2"
        />
        <p className="mt-1 text-meta text-text-faint">At least 10 characters.</p>
      </div>
      <button type="submit" disabled={status === 'submitting'} className={buttonVariantClass('primary')}>
        {status === 'submitting' ? 'Updating…' : 'Update password'}
      </button>
      {error && (
        <p role="alert" className="text-data-inline text-rust">
          {error}
        </p>
      )}
    </form>
  );
}
