const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

export interface Report {
  id: string;
  reporterUserId: string;
  reportedEntityType: string;
  reportedEntityId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  contentPreview: string | null;
  contentAuthorUserId: string | null;
  isHidden: boolean | null;
}

/**
 * Every call here carries the caller's own short-lived apiToken and
 * hits apps/api's real AdminGuard — this file has no client of its own
 * that bypasses that check. See ReportsController for the actual
 * enforcement; this is just the typed fetch wrapper apps/web's admin
 * page and its client-side action buttons both use.
 */
export async function fetchReports(apiToken: string, status?: ReportStatus): Promise<{ reports: Report[]; total: number }> {
  const qs = status ? `?status=${status}` : '';
  const res = await fetch(`${API_URL}/trust-safety/reports${qs}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: 'no-store',
  });
  if (!res.ok) return { reports: [], total: 0 };
  return res.json();
}

export async function reviewReport(
  apiToken: string,
  id: string,
  status: 'reviewed' | 'actioned' | 'dismissed',
  note?: string,
): Promise<boolean> {
  const res = await fetch(`${API_URL}/trust-safety/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note }),
  });
  return res.ok;
}
