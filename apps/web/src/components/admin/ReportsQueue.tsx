'use client';

import { useState } from 'react';
import { buttonVariantClass } from '@chosn/ui';
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

/** Task 5's two actions — dismiss (nothing warranted action) and action-taken (something was done, with a note on what). Both are just `status` + an optional note under the hood; ReportsController enforces admin on every call, this component is convenience only. */
export function ReportsQueue({ initialReports, apiToken }: ReportsQueueProps) {
  const [reports, setReports] = useState(initialReports);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

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

  if (reports.length === 0) {
    return <p className="text-body text-text-soft">No reports yet.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-moss/15">
      {reports.map((report) => (
        <div key={report.id} className="flex flex-col gap-3 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="font-mono text-ui-label font-semibold uppercase tracking-[0.06em] text-text">
                {REASON_LABEL[report.reason] ?? report.reason}
              </span>
              <span className="ml-2 text-meta text-text-faint">
                {report.reportedEntityType} · {report.reportedEntityId}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {report.isHidden && (
                <span className="font-mono text-meta uppercase tracking-[0.06em] text-signal">Hidden</span>
              )}
              <span
                className={
                  report.status === 'pending'
                    ? 'font-mono text-meta uppercase tracking-[0.06em] text-rust'
                    : 'font-mono text-meta uppercase tracking-[0.06em] text-text-faint'
                }
              >
                {report.status}
              </span>
            </div>
          </div>

          {/* The content preview task 5's QA pass added — a reviewer no longer has to go find a raw entity id to know what's even being reported. Null when the content has since been deleted. */}
          {report.contentPreview !== null ? (
            <p className="max-w-[70ch] border-l-2 border-moss/25 pl-3 text-body text-text-soft">{report.contentPreview}</p>
          ) : (
            <p className="max-w-[70ch] text-meta italic text-text-faint">Content no longer exists.</p>
          )}

          {report.details && (
            <p className="max-w-[70ch] text-meta text-text-faint">Reporter's note: {report.details}</p>
          )}

          <p className="text-meta text-text-faint">
            Filed {new Date(report.createdAt).toLocaleString()} by reporter {report.reporterUserId}
            {report.reviewNote ? ` · review note: ${report.reviewNote}` : ''}
          </p>

          {report.status === 'pending' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Note (optional)"
                value={noteDraft[report.id] ?? ''}
                onChange={(e) => setNoteDraft((prev) => ({ ...prev, [report.id]: e.target.value }))}
                className="min-w-[16rem] flex-1 border border-moss/25 bg-transparent px-3 py-1.5 text-body text-text placeholder:text-text-faint"
              />
              <button
                type="button"
                disabled={busyId === report.id}
                onClick={() => act(report.id, 'actioned')}
                className={buttonVariantClass('primary', 'w-fit')}
              >
                Action taken
              </button>
              <button
                type="button"
                disabled={busyId === report.id}
                onClick={() => act(report.id, 'dismissed')}
                className={buttonVariantClass('secondary', 'w-fit')}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
