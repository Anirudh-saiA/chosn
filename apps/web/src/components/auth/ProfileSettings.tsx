'use client';

import { useState } from 'react';
import { buttonVariantClass, Input } from '@chosn/ui';
import { AvatarIdenticon } from '@/components/AvatarIdenticon';

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
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <AvatarIdenticon seed={avatarSeed} size={56} />
        <button type="button" onClick={rerollAvatar} disabled={busy} className={buttonVariantClass('secondary', 'w-fit')}>
          {busy ? 'Generating…' : 'New avatar'}
        </button>
      </div>
      <p className="max-w-[46ch] text-meta text-text-faint">
        Generated, not a photo — nothing here can be uploaded or shown to anyone as your real picture.
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor="display-name" className="font-mono text-ui-label font-semibold uppercase tracking-[0.06em] text-text-faint">
          Display name
        </label>
        <p className="max-w-[46ch] text-meta text-text-faint">
          What CHOSN shows other members — never your real name or email.
        </p>
        <div className="flex max-w-sm items-center gap-3">
          <Input
            id="display-name"
            type="text"
            placeholder="e.g. Collector4f2a"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setSaved(false);
            }}
            maxLength={40}
          />
          <button type="button" onClick={saveDisplayName} disabled={busy} className={buttonVariantClass('primary', 'w-fit')}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
        {saved && <p className="text-meta text-moss">Saved.</p>}
      </div>
    </div>
  );
}
