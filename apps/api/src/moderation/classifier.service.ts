import { Logger } from '@nestjs/common';

const logger = new Logger('ContentClassifier');

export interface TextClassification {
  toxic: boolean;
  score: number;
}

/**
 * Task 6 — the pre-screening integration point every future UGC
 * feature (community posts, comments, DMs) calls before content goes
 * live, wired up to a real classifier now rather than left as a
 * Day-40 unknown. Perspective API (Google/Jigsaw's toxicity
 * classifier) — free, no infrastructure to run, and its request/
 * response shape was read from its actual docs before writing this,
 * not guessed:
 * https://developers.perspectiveapi.com/s/about-the-api-methods
 *
 * No-op until `PERSPECTIVE_API_KEY` is set — the same
 * convention as every other optional external integration in this
 * codebase (Sentry, Resend, PostHog): the call site never needs its
 * own "is this configured" branch, it just gets `null` back and
 * proceeds. Get a free key at https://developers.perspectiveapi.com/s/docs-get-started
 * (Google Cloud project + enabling the "Perspective Comment Analyzer
 * API" — needs the account holder's own Google Cloud console, same
 * category of setup as Day 16's Google OAuth credentials, so it's left
 * for the operator to provision rather than something this session can
 * create).
 *
 * Threshold of 0.7 for `toxic`: Perspective's own published guidance
 * uses 0.7+ as their "likely toxic" cutoff for the TOXICITY attribute
 * specifically (not a number invented here) — a caller that wants
 * different sensitivity should branch on the raw `score`, not just
 * `toxic`.
 */
export async function classifyText(text: string): Promise<TextClassification | null> {
  const apiKey = process.env.PERSPECTIVE_API_KEY;
  if (!apiKey) return null;
  if (!text.trim()) return { toxic: false, score: 0 };

  try {
    const response = await fetch(
      `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: { text },
          languages: ['en'],
          requestedAttributes: { TOXICITY: {} },
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (!response.ok) {
      logger.warn(`Perspective API returned ${response.status} — treating as unavailable, not blocking`);
      return null;
    }

    const body = (await response.json()) as {
      attributeScores?: { TOXICITY?: { summaryScore?: { value?: number } } };
    };
    const score = body.attributeScores?.TOXICITY?.summaryScore?.value;
    if (typeof score !== 'number') return null;

    return { toxic: score >= 0.7, score };
  } catch (err) {
    // Network error, timeout, malformed response — a classifier outage
    // must never itself become the reason content submission breaks.
    // See ReportsService.create's own comment: today's one caller
    // treats this as fire-and-forget for exactly this reason.
    logger.warn(`text classification failed, treating as unavailable: ${(err as Error).message}`);
    return null;
  }
}

/**
 * The image/NSFW half of task 6 — deliberately **not** wired to a live
 * third-party service today, unlike `classifyText` above. Flagged as a
 * scoped-down assumption (see docs/trust-and-safety/README.md): every
 * credible NSFW-classifier API (AWS Rekognition, Google Cloud Vision
 * SafeSearch, Sightengine) is a paid, metered service with its own
 * account/billing setup, and there is no image-bearing content type in
 * this codebase yet to actually feed it — CHOSN's real product images
 * are catalog data entered by the team, not user uploads. Wiring
 * billing to a service with nothing to call it yet is exactly the
 * "solved before it's needed, badly" failure task 6 is trying to avoid
 * on the *text* side. The integration point exists — this function's
 * signature is what a future avatar/post-image upload calls — so
 * swapping in a real provider is a body-only change, not a new feature
 * to design from scratch under time pressure once uploads exist.
 */
export async function classifyImage(_imageUrl: string): Promise<{ nsfw: boolean; score: number } | null> {
  return null;
}
