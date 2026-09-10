const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ReportReason = 'harassment' | 'doxxing' | 'scam' | 'hate_speech' | 'spam' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'doxxing', label: 'Doxxing' },
  { value: 'scam', label: 'Scam' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Other' },
];

/**
 * The regular-user half of Day 17's `reportEntity` — `lib/moderation.ts`
 * only ever covered the *admin* side (reviewing a queue). This is the
 * first real caller filing one, same generic `POST /trust-safety/reports`
 * every future reportable type (post, comment, message) calls without
 * its own reporting system, per that endpoint's own doc comment.
 */
export async function fileReport(
  apiToken: string,
  entityType: 'user' | 'post' | 'comment' | 'message',
  entityId: string,
  reason: ReportReason,
  details?: string,
): Promise<boolean> {
  const res = await fetch(`${API_URL}/trust-safety/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ reportedEntityType: entityType, reportedEntityId: entityId, reason, details }),
  });
  return res.ok;
}
