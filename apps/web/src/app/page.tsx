import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingMasthead } from '@/components/landing/LandingMasthead';
import { MarketPreview } from '@/components/landing/MarketPreview';
import { StatementSection } from '@/components/landing/StatementSection';
import { WaitlistMinimal } from '@/components/landing/WaitlistMinimal';

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
      <LandingMasthead />
      <LandingHero />
      <StatementSection />
      <MarketPreview />
      <WaitlistMinimal />
      <LandingFooter />
    </main>
  );
}
