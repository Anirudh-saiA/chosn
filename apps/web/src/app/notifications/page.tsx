import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { auth } from '@/auth';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { NotificationSettings } from '@/components/community/NotificationSettings';
import { SubscriptionPanel } from '@/components/community/SubscriptionPanel';
import { buttonVariantClass } from '@chosn/ui';

export const metadata: Metadata = {
  title: 'Notification settings',
  description: 'Manage which drops and brands CHOSN notifies you about.',
};

/**
 * Drop alerts are client-rendered — subscriberId only exists in
 * localStorage (Day 12's bare-identity model has no server session to
 * render this from). Community notifications need the signed-in
 * session, so `auth()` decides which of the two groups to show.
 * No revalidate/generateStaticParams: inherently per-visitor.
 */
export default async function NotificationsSettingsPage() {
  const session = await auth();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;

  return (
    <PageShell width="3xl">
      <PageHeader
        eyebrow="Settings"
        title={
          <>
            Notification <span className="text-brass-gradient">settings.</span>
          </>
        }
        description="What you're subscribed to, and an easy way to turn any of it off — unsubscribing should never be harder to find than subscribing was."
      />

      <div className="flex flex-col gap-8">
        <section className="panel p-5 sm:p-6" aria-labelledby="drop-alerts-h">
          <h2 id="drop-alerts-h" className="font-display text-xl font-bold text-text">
            Drop &amp; brand alerts
          </h2>
          <p className="mt-1 mb-4 text-meta text-text-soft">Every model, brand and global alert you&apos;ve turned on.</p>
          <SubscriptionPanel />
        </section>

        {apiToken ? (
          <NotificationSettings apiToken={apiToken} className="" />
        ) : (
          <section className="panel ticks flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6" aria-labelledby="comm-h">
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">
                <Lock className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 id="comm-h" className="font-display text-xl font-bold text-text">
                  Community notifications
                </h2>
                <p className="text-meta text-text-soft">Sign in to manage reply and mention alerts.</p>
              </div>
            </div>
            <Link href="/login" className={buttonVariantClass('secondary')}>
              Sign in
            </Link>
          </section>
        )}
      </div>
    </PageShell>
  );
}
