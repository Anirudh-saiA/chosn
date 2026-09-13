/**
 * Day 27 — staging needs a second allowed origin alongside production,
 * and `WEB_ORIGIN` was a single string. Comma-separated rather than a
 * new `WEB_ORIGINS`/`STAGING_ORIGIN` var: one env var to keep in sync
 * per environment, same shape Railway/Vercel dashboards already make
 * easy to edit (one text field, comma-joined), and every existing
 * single-origin deployment (nothing set, or one URL) keeps working with
 * zero changes — a one-element list behaves identically to the old
 * plain string.
 */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  const fallback = ['http://localhost:3000'];
  if (!raw?.trim()) return fallback;
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : fallback;
}
