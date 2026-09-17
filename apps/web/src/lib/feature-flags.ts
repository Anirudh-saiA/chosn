/**
 * Day 36 — a small, explicit place for feature flags, started because
 * Legit Check's "hidden" state (Day 35) was a single ad hoc change in
 * one component (removed from community/new/page.tsx's POST_TYPES
 * array) rather than a named, documented toggle. That was fine for one
 * file; it stops being fine the moment a second place needs to agree
 * with the first (Day 36's own audit found exactly that — see the
 * Community Guidelines page). One flag, one file, every consumer reads
 * the same source of truth.
 *
 * NEXT_PUBLIC_ prefix is required — this is read in client components
 * (the composer) as well as server-rendered pages (Guidelines), and a
 * server-only env var wouldn't reach the former. No secret ever lives
 * here; a feature flag is not sensitive.
 */

/**
 * Off for this version — Legit Check (Day 26: upload, magic-byte
 * validation, EXIF stripping, NSFW classifier gate) is fully built and
 * correct, but needs real object storage to accept a photo, and
 * Cloudflare R2 setup remains deferred (no real bucket/credentials
 * exist as of this flag's addition — see apps/api/.env.example's
 * STORAGE_* block). Flipping this to `true` (set
 * NEXT_PUBLIC_FEATURE_LEGIT_CHECK_ENABLED=true) re-enables creation
 * immediately, no code change needed — the backend was never touched
 * by the Day 35 hide, only this flag's consumers were.
 */
export const FEATURE_LEGIT_CHECK_ENABLED = process.env.NEXT_PUBLIC_FEATURE_LEGIT_CHECK_ENABLED === 'true';
