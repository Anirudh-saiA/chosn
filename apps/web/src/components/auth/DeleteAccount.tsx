'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Trash2 } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { FormAlert, Spinner, TextField } from './fields';

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
      <div className="flex flex-col gap-4">
        <p className="max-w-[60ch] text-body text-text-soft">
          Deletes your account, your notification subscriptions, any push registrations, your blocks,
          and your waitlist entry. Permanent — there&apos;s no undo and no recovery window.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={buttonVariantClass('secondary', 'w-fit min-h-[44px] !border-rust/50 !text-rust hover:!border-rust hover:!bg-rust/10')}
        >
          <Trash2 aria-hidden className="h-4 w-4" />
          Delete my account
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-[46ch] flex-col gap-4">
      <p className="text-body text-text">
        Type <span className="font-mono font-semibold text-rust">DELETE</span> to confirm. This cannot be undone.
      </p>
      <TextField
        label="Confirmation"
        type="text"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="DELETE"
        autoComplete="off"
        aria-label="Type DELETE to confirm account deletion"
        className="font-mono tracking-widest"
      />
      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy || confirm !== 'DELETE'}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-rust bg-rust px-5 py-[11px] text-ui-label font-semibold text-vault-deep transition-all hover:shadow-glow-rust focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice focus-visible:ring-offset-2 focus-visible:ring-offset-vault-deep disabled:pointer-events-none disabled:opacity-40"
        >
          {busy && <Spinner />}
          {busy ? 'Deleting…' : 'Permanently delete'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirm('');
            setError('');
          }}
          className={buttonVariantClass('secondary', 'w-fit min-h-[44px]')}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
