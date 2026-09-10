/**
 * Day 19 — shared flag for the local-only hero preview.
 *
 * Pulled out of LandingHero.tsx into its own module because more than
 * one component needs it: LandingHero renders the preview image and
 * its "local preview only" warning banner, and ConsentBanner needs to
 * know that banner is there so it can stack above it instead of
 * silently overlapping it (both are `fixed`/bottom-anchored).
 *
 * See LandingHero.tsx's own comment on the constant for why the image
 * itself is safe to leave unset in every real build.
 */
export const LOCAL_HERO_IMAGE = process.env.NEXT_PUBLIC_LOCAL_HERO_IMAGE;
