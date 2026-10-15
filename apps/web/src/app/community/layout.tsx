import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ComingSoonView } from '@/components/ComingSoonView';
import { COMING_SOON } from '@/lib/features';

export const metadata: Metadata = {
  title: 'Community',
  description: 'Community is coming soon to CHOSN.',
};

/** While `COMING_SOON.community` is true every route under /community shows the placeholder instead of the section. */
export default function CommunityLayout({ children }: { children: ReactNode }) {
  if (COMING_SOON.community) {
    return <ComingSoonView name="Community" blurb="Cop-or-drop votes, legit checks and price talk are on the way. Join the waitlist and we will tell you when they open." />;
  }
  return <>{children}</>;
}
