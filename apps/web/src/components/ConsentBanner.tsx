'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buttonVariantClass } from '@chosn/ui';
import { getConsent, setConsent } from '@/lib/consent';

/**
 * Day 19 task 4. Two equally-weighted buttons, no dark pattern: the
 * decline option is not a greyed-out afterthought next to a bright
 * "Accept all", and dismissing the banner without choosing leaves
 * consent undecided — which analytics.ts treats as "don't load."
 *
 * Deliberately not a blocking modal. Nothing on CHOSN requires
 * analytics to work, so holding the page hostage until someone answers
 * would be a worse experience for no privacy gain — the tracking is
 * already off until they say otherwise.
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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-moss/30 bg-vault-raised px-6 py-5"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[70ch] text-data-inline text-text-soft">
          We&apos;d like to use PostHog analytics to understand which parts of CHOSN people
          actually use. It&apos;s off unless you turn it on, and nothing here needs it to
          work.{' '}
          <Link href="/privacy" className="text-brass underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-3">
          <button type="button" onClick={() => choose('denied')} className={buttonVariantClass('secondary')}>
            Decline
          </button>
          <button type="button" onClick={() => choose('granted')} className={buttonVariantClass('primary')}>
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
}
