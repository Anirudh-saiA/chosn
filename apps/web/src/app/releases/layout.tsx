import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ComingSoonView } from '@/components/ComingSoonView';
import { COMING_SOON } from '@/lib/features';

export const metadata: Metadata = {
  title: 'Releases & news',
  description: 'Upcoming sneaker drops and the news around them, in one place.',
};

/** While `COMING_SOON.releases` is true the section shows the placeholder (Drops and News are merged here). */
export default function ReleasesLayout({ children }: { children: ReactNode }) {
  if (COMING_SOON.releases) {
    return <ComingSoonView name="Releases & news" blurb="Upcoming drops with live countdowns, and the news around them, in one place. Join the waitlist and we will tell you when it opens." />;
  }
  return <>{children}</>;
}
