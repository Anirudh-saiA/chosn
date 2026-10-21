import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Playfair_Display } from 'next/font/google';
import { ComingSoonView } from '@/components/ComingSoonView';
import { COMING_SOON } from '@/lib/features';

// The magazine's own headline face: a high-contrast display serif, loaded only for these routes.
const serif = Playfair_Display({ subsets: ['latin'], weight: ['400', '700', '900'], style: ['normal', 'italic'], variable: '--font-mag-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'The CHOSN Times',
  description: 'A daily and weekly sneaker magazine: the stories, the drops and the pictures, in pages you can turn.',
};

/** Follows the News section: while it is coming soon, so is the magazine. */
export default function MagazineLayout({ children }: { children: ReactNode }) {
  if (COMING_SOON.news) {
    return <ComingSoonView name="The CHOSN Times" blurb="Our sneaker magazine is on the way. Join the waitlist and we will tell you when it opens." />;
  }
  return <div className={serif.variable}>{children}</div>;
}
