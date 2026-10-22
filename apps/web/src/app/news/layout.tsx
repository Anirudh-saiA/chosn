import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ComingSoonView } from '@/components/ComingSoonView';
import { COMING_SOON } from '@/lib/features';

export const metadata: Metadata = {
  title: 'News',
  description: 'News is coming soon to CHOSN.',
};

/** While `COMING_SOON.news` is true every route under /news shows the placeholder instead of the section. */
export default function NewsLayout({ children }: { children: ReactNode }) {
  if (COMING_SOON.news) {
    return <ComingSoonView name="News" blurb="Sneaker news and release reports are on the way. Join the waitlist and we will tell you when they open." />;
  }
  return <>{children}</>;
}
