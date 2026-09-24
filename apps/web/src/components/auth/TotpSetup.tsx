'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ShieldCheck } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { FormAlert, Spinner, TextField } from './fields';

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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/auth/totp/status')
      .then((r) => r.json())
      .then((body) => setStatus(body.enabled ? 'on' : 'off'))
      .catch(() => setStatus('off'));
  }, []);

  async function copySecret() {
    if (!secretBase32) return;
    try {
      await navigator.clipboard.writeText(secretBase32);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the key stays selectable on screen */
    }
  }

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

  if (status === 'loading') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading two-factor status">
        <div className="skeleton h-5 w-64" />
        <div className="skeleton h-11 w-56" />
      </div>
    );
  }

  if (status === 'on') {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-3 text-body text-text">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-signal/40 bg-signal/10 text-signal">
            <ShieldCheck aria-hidden className="h-4 w-4" />
          </span>
          Two-factor authentication is on for this account.
        </p>
        <button type="button" onClick={disable} disabled={busy} className={buttonVariantClass('secondary', 'w-fit min-h-[44px]')}>
          {busy && <Spinner />}
          {busy ? 'Turning off…' : 'Turn off two-factor authentication'}
        </button>
      </div>
    );
  }

  if (status === 'enrolling') {
    return (
      <div className="grid gap-8 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-meta uppercase tracking-[0.18em] text-brass">Step 1 · Scan</p>
          {/* Plain <img>, not next/image — a locally-generated data: URI, not a remote image next/image would have anything to optimize. */}
          {qrCodeDataUrl && (
            <div className="ticks w-fit border border-text/10 bg-white p-3">
              <img src={qrCodeDataUrl} alt="Scan this QR code with your authenticator app" className="h-44 w-44" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-5">
          <p className="max-w-[46ch] text-body text-text-soft">
            Scan the code with your authenticator app (Google Authenticator, 1Password, Authy — anything that speaks TOTP), then enter the 6-digit code it shows.
          </p>
          {secretBase32 && (
            <div>
              <p className="font-mono text-meta uppercase tracking-[0.18em] text-text-soft">Can&apos;t scan it? Enter this key</p>
              <div className="mt-2 flex max-w-md items-stretch border border-text/15 bg-vault-deep/70">
                <code className="min-w-0 flex-1 break-all px-3 py-2.5 font-mono text-data-inline tracking-wider text-text">{secretBase32}</code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 border-l border-text/15 px-3 text-meta text-text-soft transition-colors hover:text-brass-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                >
                  {copied ? <Check aria-hidden className="h-4 w-4 text-signal" /> : <Copy aria-hidden className="h-4 w-4" />}
                  <span className="sr-only sm:not-sr-only">{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}
          <TextField
            label="Step 2 · Verification code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            wrapperClassName="max-w-xs"
            className="font-mono tracking-[0.3em]"
          />
          {error && <FormAlert>{error}</FormAlert>}
          <button type="button" onClick={confirmEnrollment} disabled={busy || code.length < 6} className={buttonVariantClass('primary', 'w-fit min-h-[48px]')}>
            {busy && <Spinner />}
            {busy ? 'Verifying…' : 'Turn on two-factor authentication'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[54ch] text-body text-text-soft">
        Not required — but recommended, since your account holds
        notification preferences and (later) your community identity.
      </p>
      {error && <FormAlert>{error}</FormAlert>}
      <button type="button" onClick={startEnrollment} disabled={busy} className={buttonVariantClass('primary', 'w-fit min-h-[48px]')}>
        {busy && <Spinner />}
        {busy ? 'Starting…' : 'Set up two-factor authentication'}
      </button>
    </div>
  );
}
