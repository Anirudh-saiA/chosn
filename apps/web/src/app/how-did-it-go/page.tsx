import type { Metadata } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { OrderFeedbackForm } from '@/components/feedback/OrderFeedbackForm';

export const metadata: Metadata = {
  title: 'How did your order go?',
  description: 'Tell other shoppers whether your order arrived on time and as described.',
  robots: { index: false },
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function HowDidItGoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const styleCode = one(q.shoe) ?? '';
  const store = one(q.store) ?? '';
  const valid = /^[A-Za-z0-9._-]{3,40}$/.test(styleCode) && /^[a-z0-9-]{2,40}$/.test(store);
  const size = Number(one(q.size));
  const promised = one(q.promised);

  return (
    <PageShell>
      <PageHeader eyebrow="After you buy" title="How did your order go?" description="Two minutes, no sign-in. Your answer feeds the store’s Trust score." />
      <div className="mx-auto max-w-2xl px-4 pb-16">
        {valid ? (
          <OrderFeedbackForm
            styleCode={styleCode}
            store={store}
            storeName={one(q.name) ?? store}
            shoeName={one(q.title) ?? styleCode}
            size={Number.isFinite(size) && size > 0 ? size : undefined}
            promisedMaxDays={promised && Number.isFinite(Number(promised)) ? Number(promised) : null}
          />
        ) : (
          <p className="text-sm text-text-muted">This link is missing the shoe or store. Open a shoe on CHOSN and use the reminder shown after you click Buy.</p>
        )}
      </div>
    </PageShell>
  );
}
