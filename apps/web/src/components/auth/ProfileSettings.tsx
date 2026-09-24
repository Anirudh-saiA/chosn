'use client';

import { useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { AvatarIdenticon } from '@/components/AvatarIdenticon';
import { Spinner, TextField } from './fields';

interface ProfileSettingsProps {
  initialDisplayName: string | null;
  initialAvatarSeed: string;
}

/**
 * Task 3 — the one place a signed-in user sets what other people will
 * eventually see once a community surface exists: a display name
 * (never their real name/email) and a generated avatar (never a photo
 * upload). Both write through `/api/auth/profile`.
 */
export function ProfileSettings({ initialDisplayName, initialAvatarSeed }: ProfileSettingsProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [avatarSeed, setAvatarSeed] = useState(initialAvatarSeed);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveDisplayName() {
    setBusy(true);
    setSaved(false);
    const res = await fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_display_name', displayName }),
    });
    setBusy(false);
    if (res.ok) setSaved(true);
  }

  async function rerollAvatar() {
    setBusy(true);
    const res = await fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reroll_avatar' }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && body?.avatarSeed) setAvatarSeed(body.avatarSeed);
  }

  return (
    <div className="grid gap-8 md:grid-cols-[auto_1fr]">
      <div className="flex items-center gap-4 md:flex-col md:items-start">
        <span className="rounded-full border border-brass/40 p-1 shadow-glow-brass">
          <AvatarIdenticon seed={avatarSeed} size={72} />
        </span>
        <button type="button" onClick={rerollAvatar} disabled={busy} className={buttonVariantClass('secondary', 'w-fit min-h-[44px]')}>
          <RefreshCw aria-hidden className="h-4 w-4" />
          {busy ? 'Generating…' : 'New avatar'}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <TextField
          id="display-name"
          label="Display name"
          type="text"
          placeholder="e.g. Collector4f2a"
          hint="What CHOSN shows other members — never your real name or email. Avatars are generated, never a photo."
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setSaved(false);
          }}
          maxLength={40}
          wrapperClassName="max-w-md"
        />
        <div className="flex items-center gap-4">
          <button type="button" onClick={saveDisplayName} disabled={busy} className={buttonVariantClass('primary', 'w-fit min-h-[44px]')}>
            {busy && <Spinner />}
            {busy ? 'Saving…' : 'Save'}
          </button>
          {saved && (
            <p role="status" className="flex items-center gap-1.5 text-meta text-signal">
              <Check aria-hidden className="h-4 w-4" />
              Saved
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
