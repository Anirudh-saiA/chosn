import type { Metadata } from 'next';
import { Crosshair, Eye, MessageSquareText } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { FeedbackForm } from '@/components/FeedbackForm';

export const metadata: Metadata = {
  title: 'Send feedback',
  description: 'Tell us what works, what doesn’t, and what confused you.',
};

const WANTED = [
  { icon: Crosshair, title: 'Did you believe the numbers?', text: 'Price accuracy is the whole product.' },
  { icon: Eye, title: 'How does it feel?', text: 'Look, motion, speed on your device.' },
  { icon: MessageSquareText, title: 'Was it clear?', text: 'CHOSN compares — it never sells.' },
];

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
    <PageShell width="6xl">
      <PageHeader
        eyebrow="Soft launch"
        title="Send feedback"
        description={
          <>
            CHOSN is in soft launch with a small group. Blunt is more useful than polite — especially
            about anything that confused you or that you didn&apos;t believe.
          </>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="panel ticks p-5 sm:p-8">
          <FeedbackForm />
        </div>
        <aside aria-label="What we most want to hear" className="space-y-3">
          <p className="eyebrow">What we most want to hear</p>
          {WANTED.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3 border border-text/10 bg-vault-raised/50 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">
                <Icon aria-hidden className="h-4 w-4" />
              </span>
              <div>
                <p className="text-ui-label font-semibold text-text">{title}</p>
                <p className="mt-0.5 text-meta text-text-soft">{text}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </PageShell>
  );
}
