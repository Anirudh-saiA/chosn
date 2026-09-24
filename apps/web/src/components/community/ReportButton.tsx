'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Flag, MoreHorizontal } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { fileReport, REPORT_REASONS, type ReportReason } from '@/lib/reports';

interface ReportButtonProps {
  entityType: 'post' | 'comment' | 'message' | 'user';
  entityId: string;
  /** Small inline flow (chat messages) vs. a "more actions" menu (post/comment/profile headers) — same behavior, different density. */
  variant?: 'inline' | 'button';
}

/**
 * The UI half of Day 17's generic reportEntity endpoint — a reusable
 * component rather than one built specifically for chat, since
 * posts/comments/users hit the exact same endpoint with a different
 * entityType. The `button` variant tucks Report into a kebab menu.
 */
export function ReportButton({ entityType, entityId, variant = 'inline' }: ReportButtonProps) {
  const { data: session } = useSession();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const uid = useId();

  useEffect(() => {
    if (!open || variant !== 'button') return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, variant]);

  if (!apiToken) return null;

  if (status === 'done') {
    return (
      <span role="status" className="inline-flex items-center gap-1 font-mono text-meta text-text-soft">
        <Flag className="h-3 w-3" aria-hidden /> Reported
      </span>
    );
  }

  async function submit() {
    setStatus('submitting');
    setFailed(false);
    const ok = await fileReport(apiToken!, entityType, entityId, reason);
    setStatus(ok ? 'done' : 'idle');
    if (!ok) {
      setFailed(true);
      if (variant === 'inline') setOpen(false);
    }
  }

  const form = (
    <span className="flex flex-wrap items-center gap-2 font-mono text-meta">
      <label htmlFor={`${uid}-reason`} className="sr-only">
        Report reason
      </label>
      <select
        id={`${uid}-reason`}
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportReason)}
        className="min-h-9 border border-text/20 bg-vault-deep px-2 text-text"
      >
        {REPORT_REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={status === 'submitting'}
        className="min-h-9 border border-rust/50 bg-rust/10 px-3 font-semibold text-rust hover:bg-rust/20 disabled:opacity-50"
      >
        {status === 'submitting' ? 'Sending…' : 'Submit'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="min-h-9 px-2 text-text-soft hover:text-text">
        Cancel
      </button>
    </span>
  );

  if (variant === 'inline') {
    if (!open) {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Report this message"
          className="inline-flex min-h-8 items-center gap-1 px-1.5 font-mono text-meta text-text-soft hover:text-rust"
        >
          <Flag className="h-3 w-3" aria-hidden /> Report
        </button>
      );
    }
    return form;
  }

  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex h-11 w-11 items-center justify-center text-text-soft transition-colors hover:bg-text/[0.06] hover:text-text sm:h-9 sm:w-9"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {open && (
        <span className="absolute right-0 top-full z-30 mt-1 flex w-max max-w-[calc(100vw-2.5rem)] flex-col gap-2 border border-text/15 bg-vault-raised p-3 shadow-lift">
          <span className="inline-flex items-center gap-1.5 font-mono text-meta font-semibold uppercase tracking-[0.1em] text-text-soft">
            <Flag className="h-3 w-3" aria-hidden /> Report this {entityType}
          </span>
          {form}
          {failed && (
            <span role="alert" className="font-mono text-meta text-rust">
              Could not send report — try again.
            </span>
          )}
        </span>
      )}
    </span>
  );
}
