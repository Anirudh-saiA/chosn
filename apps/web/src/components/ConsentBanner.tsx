'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { getConsent, setConsent } from '@/lib/consent';
import { LOCAL_HERO_IMAGE } from '@/lib/local-preview';

/**
 * Day 19 task 4. Two equally-weighted buttons, no dark pattern: the
 * decline option is not a greyed-out afterthought next to a bright
 * "Accept all", and dismissing the banner without choosing leaves
 * consent undecided — which analytics.ts treats as "don't load."
 * Both buttons deliberately share one style.
 *
 * Deliberately not a blocking modal. Nothing on CHOSN requires
 * analytics to work, so holding the page hostage until someone answers
 * would be a worse experience for no privacy gain — the tracking is
 * already off until they say otherwise.
 *
 * Day 19 local-preview fix: when the local-only hero image is active
 * (see lib/local-preview.ts) LandingHero renders its own fixed
 * bottom-0 warning ribbon. Both are bottom-anchored, so without this
 * offset they'd stack directly on top of each other and only the one
 * rendered later in the DOM would actually be visible — which is what
 * was happening. This never applies to a real deployment: the flag is
 * unset there, so this is always `bottom-0` in production.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Read in an effect, not during render: localStorage isn't
    // available server-side, and rendering the banner during SSR then
    // hiding it on hydration causes a visible flash for people who
    // already answered.
    if (getConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  function choose(state: 'granted' | 'denied') {
    setConsent(state);
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      className={`fixed inset-x-3 z-50 sm:inset-x-auto sm:left-4 sm:w-[min(30rem,calc(100vw-2rem))] ${
        LOCAL_HERO_IMAGE ? 'bottom-11 sm:bottom-12' : 'bottom-3 sm:bottom-4'
      }`}
    >
      <div className="glass ticks p-4 shadow-lift sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">
            <Cookie aria-hidden className="h-4 w-4" />
          </span>
          <p className="text-data-inline leading-relaxed text-text-soft">
            We&apos;d like to use PostHog analytics to understand which parts of CHOSN people
            actually use. It&apos;s off unless you turn it on, and nothing here needs it to
            work.{' '}
            <Link href="/privacy" className="link-underline text-brass-bright">
              Privacy Policy
            </Link>
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => choose('denied')} className={buttonVariantClass('secondary', 'min-h-[44px]')}>
            Decline
          </button>
          <button type="button" onClick={() => choose('granted')} className={buttonVariantClass('secondary', 'min-h-[44px]')}>
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
}
