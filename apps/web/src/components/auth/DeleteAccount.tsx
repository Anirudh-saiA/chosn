'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { buttonVariantClass, Input } from '@chosn/ui';

/**
 * Day 19 task 6 — the user-facing half of erasure. Deliberately a
 * two-step, typed confirmation rather than a single button: this is
 * irreversible and cascades across subscriptions, push registrations,
 * blocks, and the waitlist entry.
 */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setBusy(false);
      setError(body?.message ?? 'Could not delete the account — try again, or email hello@chosn.app.');
      return;
    }
    // Account row is gone; clear the cookie too so the browser isn't
    // left holding a token for an account that no longer exists.
    await signOut({ callbackUrl: '/' });
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        <p className="max-w-[60ch] text-body text-text-soft">
          Deletes your account, your notification subscriptions, any push registrations, your blocks,
          and your waitlist entry. Permanent — there&apos;s no undo and no recovery window.
        </p>
        <button type="button" onClick={() => setOpen(true)} className={buttonVariantClass('secondary', 'w-fit')}>
          Delete my account
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-[46ch] flex-col gap-3 border-l-2 border-rust pl-4">
      <p className="text-body text-text">
        Type <span className="font-mono font-semibold">DELETE</span> to confirm. This cannot be undone.
      </p>
      <Input
        type="text"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="DELETE"
        aria-label="Type DELETE to confirm account deletion"
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy || confirm !== 'DELETE'}
          className={buttonVariantClass('primary', 'w-fit')}
        >
          {busy ? 'Deleting…' : 'Permanently delete'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirm('');
            setError('');
          }}
          className={buttonVariantClass('secondary', 'w-fit')}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-data-inline text-rust">
          {error}
        </p>
      )}
    </div>
  );
}
