'use client';

import { useEffect, useState } from 'react';
import { buttonVariantClass, Input } from '@chosn/ui';

type Status = 'loading' | 'off' | 'enrolling' | 'on';

/**
 * Task 2 — opt-in, never required. Three states: off (default for
 * every account), enrolling (secret generated, waiting on a confirming
 * code — proves the authenticator app is actually configured before
 * MFA turns on, so a botched enrollment can't lock someone out), on.
 */
export function TotpSetup() {
  const [status, setStatus] = useState<Status>('loading');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secretBase32, setSecretBase32] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/totp/status')
      .then((r) => r.json())
      .then((body) => setStatus(body.enabled ? 'on' : 'off'))
      .catch(() => setStatus('off'));
  }, []);

  async function startEnrollment() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/totp/enroll', { method: 'POST' });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError('Could not start setup — try again.');
      return;
    }
    setQrCodeDataUrl(body.qrCodeDataUrl);
    setSecretBase32(body.secretBase32);
    setStatus('enrolling');
  }

  async function confirmEnrollment() {
    if (!secretBase32) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/totp/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretBase32, code }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(body?.message ?? 'Something went wrong — try again.');
      return;
    }
    setStatus('on');
    setCode('');
  }

  async function disable() {
    setBusy(true);
    await fetch('/api/auth/totp/disable', { method: 'POST' });
    setBusy(false);
    setStatus('off');
  }

  if (status === 'loading') return <p className="text-body text-text-soft">Loading…</p>;

  if (status === 'on') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body text-text-soft">Two-factor authentication is on for this account.</p>
        <button type="button" onClick={disable} disabled={busy} className={buttonVariantClass('secondary', 'w-fit')}>
          {busy ? 'Turning off…' : 'Turn off two-factor authentication'}
        </button>
      </div>
    );
  }

  if (status === 'enrolling') {
    return (
      <div className="flex max-w-[46ch] flex-col gap-4">
        <p className="text-body text-text-soft">
          Scan this with your authenticator app (Google Authenticator, 1Password, Authy — anything that speaks TOTP), then enter the 6-digit code it shows.
        </p>
        {/* Plain <img>, not next/image — a locally-generated data: URI, not a remote image next/image would have anything to optimize. */}
        {qrCodeDataUrl && (
          <img src={qrCodeDataUrl} alt="Scan this QR code with your authenticator app" className="h-48 w-48 border border-moss/25" />
        )}
        {secretBase32 && (
          <p className="font-mono text-meta text-text-faint">
            Can't scan it? Enter this key manually: <span className="text-text">{secretBase32}</span>
          </p>
        )}
        <Input
          type="text"
          inputMode="numeric"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        <button type="button" onClick={confirmEnrollment} disabled={busy || code.length < 6} className={buttonVariantClass('primary', 'w-fit')}>
          {busy ? 'Verifying…' : 'Turn on two-factor authentication'}
        </button>
        {error && (
          <p role="alert" className="text-data-inline text-rust">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[46ch] text-body text-text-soft">
        Not required — but recommended, since your account holds
        notification preferences and (later) your community identity.
      </p>
      <button type="button" onClick={startEnrollment} disabled={busy} className={buttonVariantClass('primary', 'w-fit')}>
        {busy ? 'Starting…' : 'Set up two-factor authentication'}
      </button>
      {error && (
        <p role="alert" className="text-data-inline text-rust">
          {error}
        </p>
      )}
    </div>
  );
}
