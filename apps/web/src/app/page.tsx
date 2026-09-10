import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingMasthead } from '@/components/landing/LandingMasthead';
import { MarketPreview } from '@/components/landing/MarketPreview';
import { StatementSection } from '@/components/landing/StatementSection';
import { WaitlistMinimal } from '@/components/landing/WaitlistMinimal';
import { LOCAL_HERO_IMAGE } from '@/lib/local-preview';

/**
 * Landing-page-only fashion-editorial fork — see
 * packages/config/tailwind-preset.js's ink/bone/ember comment and
 * apps/web/src/app/layout.tsx's font comment for the full reasoning.
 * Every other route in this app is untouched: Masthead, the Day 2
 * design tokens, Zilla Slab/Archivo — none of it changed. This page
 * alone opts into components/landing/'s separate system.
 *
 * The previous version of this page (Hero + HowItWorks + CommunityIntro,
 * all on the real design system) is fully intact in git history if this
 * direction doesn't stick.
 */
export default function HomePage() {
  return (
    <main className="relative">
      {/* Day 19 local-preview mode: the current NEXT_PUBLIC_LOCAL_HERO_IMAGE
          reference photo has a complete hero composition — its own
          wordmark, nav, headline, and footer copy — baked into the
          pixels. Rendering the real Masthead on top of that just
          duplicates it, so it's hidden for this mode only; unset in
          every real build, so this never affects production. */}
      {!LOCAL_HERO_IMAGE && <LandingMasthead />}
      <LandingHero />
      <StatementSection />
      <MarketPreview />
      <WaitlistMinimal />
      <LandingFooter />
    </main>
  );
}
