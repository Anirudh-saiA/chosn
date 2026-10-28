'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing, CalendarPlus, Check, Heart } from 'lucide-react';
import { API_URL, ensureWatchId, getWatchId } from '@/lib/watch';

const LEADS = [
  { minutes: 1440, label: '1 day before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 15, label: '15 min before' },
] as const;

function savedSize(): number | null {
  try {
    const n = Number(window.localStorage.getItem('chosn:size'));
    return n >= 1 && n <= 20 ? n : null;
  } catch {
    return null;
  }
}

let shared: Promise<Mine | null> | null = null;

interface Mine {
  follows: Array<{ kind: string; ref: string }>;
  reminders: Array<{ dropId: string; minutes: number[] }>;
}

const BTN =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-60';
const ACTIVE = 'border-[#0A0A0A] bg-[#0A0A0A] text-white';
const IDLE = 'border-[#0A0A0A]/15 bg-white text-[#0A0A0A] hover:border-[#0A0A0A]';

/**
 * "Notify me" for one drop: follow it, pick reminders (1 day / 1 hour / 15 minutes) and add it to a calendar. Everything hangs off the
 * anonymous watch id (the same one the wishlist alerts use), so no account is needed. A date-only drop can only be reminded the day before.
 */
export function DropFollow({ dropId, brand, dateOnly, compact = false }: { dropId: string; brand: string; dateOnly: boolean; compact?: boolean }) {
  const [followed, setFollowed] = useState(false);
  const [brandFollowed, setBrandFollowed] = useState(false);
  const [minutes, setMinutes] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [google, setGoogle] = useState<string | null>(null);

  useEffect(() => {
    const id = getWatchId();
    if (!id) return;
    // One request serves every card on the page.
    shared ??= fetch(`${API_URL}/watch/${id}/drops`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Mine>) : null))
      .catch(() => null);
    void shared
      .then((m) => {
        if (!m) return;
        setFollowed(m.follows.some((f) => f.kind === 'drop' && f.ref === dropId));
        setBrandFollowed(m.follows.some((f) => f.kind === 'brand' && f.ref === brand));
        setMinutes(m.reminders.find((r) => r.dropId === dropId)?.minutes ?? []);
      })
      .catch(() => undefined);
  }, [dropId, brand]);

  useEffect(() => {
    if (!open || google) return;
    void fetch(`${API_URL}/drops/${dropId}/google-calendar`)
      .then((r) => (r.ok ? (r.json() as Promise<{ url: string }>) : null))
      .then((b) => b && setGoogle(b.url))
      .catch(() => undefined);
  }, [open, google, dropId]);

  async function put(path: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const id = await ensureWatchId();
      if (!id) throw new Error('no id');
      const res = await fetch(`${API_URL}/watch/${id}/drops/${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
      shared = null; // the next card or page asks again
      return true;
    } catch {
      setError('Could not save that. Try again in a moment.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleLead(m: number) {
    const next = minutes.includes(m) ? minutes.filter((x) => x !== m) : [...minutes, m];
    if (await put('reminders', { dropId, minutes: next, size: savedSize() })) {
      setMinutes(next);
      if (next.length > 0) setFollowed(true);
    }
  }

  async function toggleFollow() {
    const on = !followed;
    if (await put('follow', { kind: 'drop', ref: dropId, on, size: savedSize() })) setFollowed(on);
  }

  async function toggleBrand() {
    const on = !brandFollowed;
    if (await put('follow', { kind: 'brand', ref: brand, on })) setBrandFollowed(on);
  }

  const leads = dateOnly ? LEADS.filter((l) => l.minutes === 1440) : LEADS;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${BTN} ${minutes.length ? ACTIVE : IDLE}`}>
          {minutes.length ? <BellRing className="h-3.5 w-3.5" aria-hidden /> : <Bell className="h-3.5 w-3.5" aria-hidden />}
          {minutes.length ? `Reminders on (${minutes.length})` : 'Notify me'}
        </button>
        <button type="button" disabled={busy} onClick={toggleFollow} aria-pressed={followed} className={`${BTN} ${followed ? ACTIVE : IDLE}`}>
          <Heart className={`h-3.5 w-3.5 ${followed ? 'fill-current' : ''}`} aria-hidden /> {followed ? 'Following' : 'Follow'}
        </button>
        {!compact && (
          <button type="button" disabled={busy} onClick={toggleBrand} aria-pressed={brandFollowed} className={`${BTN} ${brandFollowed ? ACTIVE : IDLE}`}>
            {brandFollowed ? <Check className="h-3.5 w-3.5" aria-hidden /> : null} {brandFollowed ? `Following ${brand}` : `Follow ${brand}`}
          </button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#0A0A0A]/10 bg-white p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-text-faint">Remind me</p>
          <div className="flex flex-wrap gap-2">
            {leads.map((l) => (
              <button key={l.minutes} type="button" disabled={busy} onClick={() => toggleLead(l.minutes)} aria-pressed={minutes.includes(l.minutes)} className={`${BTN} ${minutes.includes(l.minutes) ? ACTIVE : IDLE}`}>
                {minutes.includes(l.minutes) ? <Check className="h-3.5 w-3.5" aria-hidden /> : null} {l.label}
              </button>
            ))}
          </div>
          {dateOnly && <p className="text-meta text-text-soft">The time isn&apos;t announced yet, so the reminder comes at 9:00 AM IST the day before.</p>}
          <p className="text-meta text-text-soft">Reminders appear in your bell, and by e-mail if you&apos;ve confirmed one. If you&apos;ve saved a size, we&apos;ll also tell you when it lands in Indian stores.</p>
          <div className="flex flex-wrap gap-2 border-t border-text/[0.08] pt-3">
            {google && (
              <a href={google} target="_blank" rel="noopener noreferrer" className={`${BTN} ${IDLE}`}>
                <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Google Calendar
              </a>
            )}
            <a href={`${API_URL}/drops/${dropId}/calendar.ics`} className={`${BTN} ${IDLE}`}>
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Apple / Outlook (.ics)
            </a>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-meta text-rust">{error}</p>}
    </div>
  );
}
