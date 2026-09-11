const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

export interface Report {
  id: string;
  /** Null means system-filed (e.g. Day 24's vote-manipulation guard), not a human reporter. */
  reporterUserId: string | null;
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

export interface CommunityHealthSummary {
  postsPerDay: { day: string; postType: string; count: number }[];
  activeUsers7d: number;
  reports: { last7d: number; last30d: number; byStatus: Record<string, number>; resolutionRatePct: number };
  highReportRooms: { roomId: string; dropEventId: string; sneakerLabel: string | null; reportCount: number }[];
}

/** Day 24 task 5 — the admin-only community health dashboard's one data call. */
export async function fetchCommunityHealth(apiToken: string): Promise<CommunityHealthSummary | null> {
  const res = await fetch(`${API_URL}/admin/community-health`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
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
