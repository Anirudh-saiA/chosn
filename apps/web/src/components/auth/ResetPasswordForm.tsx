'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { buttonVariantClass } from '@chosn/ui';
import { FormAlert, PasswordField, Spinner } from './fields';

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

  const busy = status === 'submitting';
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <PasswordField
        id={passwordId}
        label="New password"
        required
        minLength={10}
        autoComplete="new-password"
        hint="At least 10 characters."
        meter
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      {error && <FormAlert>{error}</FormAlert>}
      <button type="submit" disabled={busy} className={buttonVariantClass('primary', 'min-h-[48px]')}>
        {busy && <Spinner />}
        {busy ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}
