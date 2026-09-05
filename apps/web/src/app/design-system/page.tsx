import { Badge, Button, Card, Input, PriceFigure } from '@chosn/ui';

/**
 * Internal visual QA route, standing in for Storybook today (see the
 * assumption logged in README.md). Not linked from product nav.
 */
export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-14 px-6 py-16">
      <header>
        <p className="font-mono text-meta uppercase tracking-[0.1em] text-text-faint">
          Internal — not shipped
        </p>
        <h1 className="font-display text-display-section font-semibold text-text">
          Component primitives
        </h1>
        <p className="mt-2 max-w-prose text-body text-text-soft">
          Every value below comes from @chosn/config&apos;s Tailwind preset — nothing here is a
          hardcoded hex or pixel value.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-4">
        <Button variant="primary">Compare a price</Button>
        <Button variant="secondary">View listings</Button>
        <Button variant="ghost">Join the community</Button>
      </section>

      <section className="flex flex-wrap gap-4">
        <Card className="w-64 p-5">
          <p className="mb-3 text-ui-label font-semibold text-text">Vault surface</p>
          <PriceFigure value="₹9,499" deltaPct={2.1} />
        </Card>
        <Card surface="chalk" className="w-64 p-5">
          <p className="mb-3 text-ui-label font-semibold text-text-chalk">Chalk surface</p>
          <PriceFigure value="₹18,750" deltaPct={-3.4} />
        </Card>
      </section>

      <section className="flex flex-wrap gap-3">
        <Badge state="buy">Buy · 6% below average</Badge>
        <Badge state="wait">Wait · near 90-day high</Badge>
        <Badge state="neutral">No signal yet</Badge>
      </section>

      <section className="max-w-sm">
        <Input placeholder="you@email.com" />
      </section>
    </main>
  );
}
