'use client';

import { useState } from 'react';
import { EyeOff, Inbox } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { CountUp } from '@/components/fx/CountUp';
import { reviewReport, type Report } from '@/lib/moderation';

interface ReportsQueueProps {
  initialReports: Report[];
  apiToken: string;
}

const REASON_LABEL: Record<string, string> = {
  harassment: 'Harassment',
  doxxing: 'Doxxing',
  scam: 'Scam',
  hate_speech: 'Hate speech',
  spam: 'Spam',
  other: 'Other',
};

type Filter = 'all' | 'pending' | 'actioned' | 'dismissed';

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'pending'
      ? 'border-rust/50 bg-rust/10 text-rust'
      : status === 'actioned'
        ? 'border-signal/50 bg-signal/10 text-signal'
        : 'border-text/15 bg-text/[0.04] text-text-soft';
  return <span className={`border px-2 py-0.5 font-mono text-meta uppercase tracking-[0.12em] ${tone}`}>{status}</span>;
}

/** Task 5's two actions — dismiss (nothing warranted action) and action-taken (something was done, with a note on what). Both are just `status` + an optional note under the hood; ReportsController enforces admin on every call, this component is convenience only. */
export function ReportsQueue({ initialReports, apiToken }: ReportsQueueProps) {
  const [reports, setReports] = useState(initialReports);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  async function act(id: string, status: 'actioned' | 'dismissed') {
    setBusyId(id);
    const ok = await reviewReport(apiToken, id, status, noteDraft[id]?.trim() || undefined);
    setBusyId(null);
    if (ok) {
      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status,
                reviewNote: noteDraft[id]?.trim() || null,
                // "Actioned" also hides the underlying content server-side
                // (ReportsService.review) for every type except 'user',
                // which has nothing to hide — mirror that here rather
                // than waiting on a refetch.
                isHidden: status === 'actioned' && r.reportedEntityType !== 'user' ? true : r.isHidden,
              }
            : r,
        ),
      );
    }
  }

  const count = (f: Filter) => (f === 'all' ? reports.length : reports.filter((r) => r.status === f).length);
  const FILTERS: Filter[] = ['all', 'pending', 'actioned', 'dismissed'];
  const shown = filter === 'all' ? reports : reports.filter((r) => r.status === filter);

  if (reports.length === 0) {
    return (
      <div className="panel ticks flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center border border-signal/40 bg-signal/10 text-signal">
          <Inbox aria-hidden className="h-6 w-6" />
        </span>
        <p className="font-display text-2xl font-semibold text-text">Queue is clear</p>
        <p className="text-text-soft">No reports yet.</p>
      </div>
    );
  }

  return (
    <div>
      <dl className="mb-6 grid grid-cols-2 gap-px border border-text/10 bg-text/10 sm:grid-cols-4">
        {FILTERS.map((f) => (
          <div key={f} className="bg-vault px-4 py-4">
            <dt className="font-mono text-meta uppercase tracking-[0.16em] text-text-soft">{f}</dt>
            <dd className={`mt-2 font-mono text-3xl font-medium ${f === 'pending' && count(f) > 0 ? 'text-rust' : 'text-text'}`}>
              <CountUp to={count(f)} duration={0.8} />
            </dd>
          </div>
        ))}
      </dl>

      <div role="group" aria-label="Filter reports by status" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-[44px] border px-4 font-mono text-data-delta font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice ${
              filter === f
                ? 'border-brass-bright bg-brass-gradient text-vault-deep'
                : 'border-text/15 bg-vault-raised/60 text-text-soft hover:border-brass/60 hover:text-text'
            }`}
          >
            {f} <span className="opacity-70">({count(f)})</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="border border-dashed border-text/15 px-4 py-10 text-center text-meta text-text-faint">Nothing with status “{filter}”.</p>
      ) : (
        <ul className="panel flex flex-col divide-y divide-text/[0.07]">
          {shown.map((report) => (
            <li key={report.id} className="flex flex-col gap-3 px-4 py-5 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-ui-label font-semibold uppercase tracking-[0.1em] text-text">
                    {REASON_LABEL[report.reason] ?? report.reason}
                  </span>
                  <span className="break-all font-mono text-meta text-text-faint">
                    {report.reportedEntityType} · {report.reportedEntityId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {report.isHidden && (
                    <span className="inline-flex items-center gap-1 border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-meta uppercase tracking-[0.12em] text-signal">
                      <EyeOff aria-hidden className="h-3 w-3" /> Hidden
                    </span>
                  )}
                  <StatusPill status={report.status} />
                </div>
              </div>

              {/* The content preview task 5's QA pass added — a reviewer no longer has to go find a raw entity id to know what's even being reported. Null when the content has since been deleted. */}
              {report.contentPreview !== null ? (
                <p className="max-w-[70ch] border-l-2 border-brass/40 bg-vault-recessed/50 py-2 pl-3 text-body text-text-soft">{report.contentPreview}</p>
              ) : (
                <p className="max-w-[70ch] text-meta italic text-text-faint">Content no longer exists.</p>
              )}

              {report.details && <p className="max-w-[70ch] text-meta text-text-soft">Reporter&apos;s note: {report.details}</p>}

              <p className="font-mono text-meta text-text-faint">
                Filed {new Date(report.createdAt).toLocaleString()} by{' '}
                {report.reporterUserId ? `reporter ${report.reporterUserId}` : 'CHOSN (auto-flagged, see details)'}
                {report.reviewNote ? ` · review note: ${report.reviewNote}` : ''}
              </p>

              {report.status === 'pending' && (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`note-${report.id}`} className="sr-only">
                    Review note (optional)
                  </label>
                  <input
                    id={`note-${report.id}`}
                    type="text"
                    placeholder="Note (optional)"
                    value={noteDraft[report.id] ?? ''}
                    onChange={(e) => setNoteDraft((prev) => ({ ...prev, [report.id]: e.target.value }))}
                    className="min-h-[44px] min-w-[14rem] flex-1 border border-text/15 bg-vault-deep/70 px-3 py-1.5 text-body text-text outline-none transition-all placeholder:text-text-faint hover:border-text/30 focus:border-ice focus:shadow-[0_0_0_3px_rgba(143,214,255,.18)]"
                  />
                  <button
                    type="button"
                    disabled={busyId === report.id}
                    onClick={() => act(report.id, 'actioned')}
                    className={buttonVariantClass('primary', 'w-fit min-h-[44px]')}
                  >
                    Action taken
                  </button>
                  <button
                    type="button"
                    disabled={busyId === report.id}
                    onClick={() => act(report.id, 'dismissed')}
                    className={buttonVariantClass('secondary', 'w-fit min-h-[44px]')}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
