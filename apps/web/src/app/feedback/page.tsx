import type { Metadata } from 'next';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { FeedbackForm } from '@/components/FeedbackForm';

export const metadata: Metadata = {
  title: 'Send feedback | CHOSN',
  description: 'Tell us what works, what doesn’t, and what confused you.',
};

/**
 * Day 19 task 8. The three prompts below aren't generic "how are we
 * doing" filler — they're aimed at the specific blind spots the brief
 * names, and they're the three things nobody inside the build can
 * assess honestly:
 *
 *   1. Price-accuracy trust — the whole product is a claim about
 *      numbers. Whether people *believe* the numbers is invisible from
 *      inside; the data can be correct and still not be trusted.
 *   2. Design/motion feel — Day 18 rebuilt the landing page around a
 *      motion language nobody outside this project has reacted to yet.
 *   3. "Not a marketplace" comprehension — the single positioning risk
 *      that's existed since Day 1. If people think CHOSN sells shoes,
 *      every other metric is misleading.
 */
export default function FeedbackPage() {
  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-3xl px-6 py-10 lg:py-14">
        <p className="font-mono text-ui-label uppercase tracking-[0.06em] text-text-faint">Soft launch</p>
        <h1 className="mt-2 font-display text-display-section font-semibold text-text">Send feedback</h1>
        <p className="mt-4 max-w-[60ch] text-body text-text-soft">
          CHOSN is in soft launch with a small group. Blunt is more useful than polite — especially
          about anything that confused you or that you didn&apos;t believe.
        </p>
        <div className="mt-8">
          <FeedbackForm />
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
