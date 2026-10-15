import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ComingSoonView } from '@/components/ComingSoonView';
import { COMING_SOON } from '@/lib/features';

export const metadata: Metadata = {
  title: 'Drops',
  description: 'Drops is coming soon to CHOSN.',
};

/** While `COMING_SOON.drops` is true every route under /drops shows the placeholder instead of the section. */
export default function DropsLayout({ children }: { children: ReactNode }) {
  if (COMING_SOON.drops) {
    return <ComingSoonView name="Drops" blurb="Upcoming releases with live countdowns are on the way. Join the waitlist and we will tell you when they open." />;
  }
  return <>{children}</>;
}
