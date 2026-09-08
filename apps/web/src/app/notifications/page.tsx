import type { Metadata } from 'next';
import { Masthead } from '@/components/Masthead';
import { SubscriptionList } from '@/components/drops/SubscriptionList';

export const metadata: Metadata = {
  title: 'Notification settings | CHOSN',
  description: 'Manage which drops and brands CHOSN notifies you about.',
};

/**
 * Fully client-rendered below the header — subscriberId only exists in
 * localStorage (Day 12's bare-identity model has no server session to
 * render this from), so there is nothing real to server-render here.
 * No revalidate/generateStaticParams: this route is inherently
 * per-visitor, not cacheable content.
 */
export default function NotificationsSettingsPage() {
  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-2xl px-6 py-10 lg:py-12">
        <header className="mb-8">
          <h1 className="font-display text-display-section font-semibold text-text">Notifications</h1>
          <p className="mt-2 text-body text-text-soft">
            What you're subscribed to, and an easy way to turn any of it
            off — unsubscribing should never be harder to find than
            subscribing was.
          </p>
        </header>

        <SubscriptionList />
      </div>
    </main>
  );
}
