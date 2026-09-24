import type { Metadata } from 'next';
import { DropLiveProvider } from '@/components/drops/drop-live-context';
import { DropsExplorer } from '@/components/drops/DropsExplorer';
import { SubscriptionsProvider } from '@/components/drops/subscriptions-context';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { fetchDropsList } from '@/lib/drops';

export const metadata: Metadata = {
  title: 'Drop calendar',
  description: 'Every upcoming and live sneaker drop CHOSN is tracking — release dates, times, and where to actually try to buy at retail.',
};

/**
 * Same ISR rationale as Day 10's price page: a real organic search
 * surface (task 7) — "when does X drop" is a search query people
 * actually type, so this needs to be crawlable and fast, not client-
 * rendered from an empty shell. 300s: a drop calendar changes on the
 * order of days, not seconds; the live status flip itself is handled
 * separately by the WebSocket connection below, not by revalidation.
 */
export const revalidate = 300;

export default async function DropsPage() {
  const drops = await fetchDropsList({}, { next: { revalidate: 300 } });

  return (
    <PageShell width="7xl">
      <PageHeader
        eyebrow="Live release radar"
        title="Drop calendar"
        description="Every launch we're tracking, real release dates and times — not a rumor calendar. Statuses update live the moment a drop actually goes live, no refresh needed."
      />

      {/* One shared WebSocket connection and one shared subscriptions
          fetch for every drop card on this page (Day 15) — see each
          provider's own comment on why that matters once a page shows
          more than one drop; the latter was a real, measured
          Lighthouse regression before this fix (drops/README.md). */}
      <DropLiveProvider>
        <SubscriptionsProvider>
          <DropsExplorer drops={drops} />
        </SubscriptionsProvider>
      </DropLiveProvider>
    </PageShell>
  );
}
