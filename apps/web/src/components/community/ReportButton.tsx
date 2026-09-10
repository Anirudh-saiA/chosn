'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { fileReport, REPORT_REASONS, type ReportReason } from '@/lib/reports';

interface ReportButtonProps {
  entityType: 'post' | 'comment' | 'message';
  entityId: string;
  /** Small inline text link (chat messages) vs. a normal button (post/comment footers) — same behavior, different density. */
  variant?: 'inline' | 'button';
}

/**
 * The UI half of Day 17's generic reportEntity endpoint, wired up for
 * real (task 7) — a reusable component rather than one built specifically
 * for chat, since posts/comments hit the exact same endpoint with a
 * different entityType.
 */
export function ReportButton({ entityType, entityId, variant = 'inline' }: ReportButtonProps) {
  const { data: session } = useSession();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');

  if (!apiToken) return null;

  if (status === 'done') {
    return <span className="font-mono text-meta text-text-faint">Reported</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === 'inline'
            ? 'font-mono text-meta text-text-faint hover:text-rust'
            : 'border border-moss/30 px-2 py-0.5 font-mono text-meta text-text-faint hover:border-rust hover:text-rust'
        }
      >
        Report
      </button>
    );
  }

  async function submit() {
    setStatus('submitting');
    const ok = await fileReport(apiToken!, entityType, entityId, reason);
    setStatus(ok ? 'done' : 'idle');
    if (!ok) setOpen(false);
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-meta">
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportReason)}
        className="border border-moss/30 bg-vault px-1 py-0.5 text-text"
      >
        {REPORT_REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={submit} disabled={status === 'submitting'} className="text-rust hover:underline disabled:opacity-50">
        Submit
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-text-faint hover:text-text">
        Cancel
      </button>
    </span>
  );
}
