/**
 * Day 26 — the WebSocket base URL, shared by drop-live-context.tsx and
 * chat.ts. Both gateways run in the same apps/api process as the REST
 * API today, so deriving ws(s):// from NEXT_PUBLIC_API_URL (a scheme
 * swap) has always been correct with zero extra config — that fallback
 * stays the default. `NEXT_PUBLIC_WS_URL`, when set, overrides it
 * outright: the one config change needed if the WebSocket gateway ever
 * moves to a different host/load balancer than the REST API (e.g. a
 * dedicated Railway service, or a domain in front of a multi-instance
 * deployment) without touching either call site.
 */
export function wsBaseUrl(): string {
  const override = process.env.NEXT_PUBLIC_WS_URL;
  if (override) return override.replace(/\/+$/, '');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return apiUrl.replace(/^http/, 'ws');
}
